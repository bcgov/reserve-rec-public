#!/usr/bin/env python3
"""Read the front-door WAF Count soak and report what each rule would have blocked.

Answers the questions gating the promotion to Block:
  - what threshold the rate rule should carry, and on which path
  - whether AnonymousIpList is safe to enforce
  - whether dc-m247 (and each other provider) should finally block

Usage:
  soak_report.py --env dev [--days 28] [--json]

Read-only: CloudWatch Logs Insights queries against the WAF log group.
"""

import argparse
import json
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

import boto3

ENV_ACCOUNTS = {"dev": "623829546818", "test": "623829546818", "prod": "628373393242"}
REGION = "us-east-1"
API_PREFIX = "/dayuse/api/"
INSIGHTS_LIMIT = 10000
# The rate rule's window. WAF evaluates rate-based rules over a trailing window;
# the threshold has to be read against the same bucket size or it means nothing.
RATE_WINDOW_SEC = 300


def log_group(env):
    return f"aws-waf-logs-reserve-rec-front-door-{env}"


def acl_rule_names(session, env):
    """Rule names in priority order, read from the live ACL.

    Taken from the deployed ACL rather than a list in this file: the repo is
    public and must not name the providers, and this also stays right when the
    ruleset changes.
    """
    waf = session.client("wafv2", region_name=REGION)
    name = f"reserve-rec-front-door-{env}"
    acls = {a["Name"]: a for a in waf.list_web_acls(Scope="CLOUDFRONT")["WebACLs"]}
    if name not in acls:
        return []
    acl = waf.get_web_acl(Name=name, Scope="CLOUDFRONT", Id=acls[name]["Id"])["WebACL"]
    return [r["Name"] for r in sorted(acl["Rules"], key=lambda r: r["Priority"])]


def run_query(logs, group, start, end, query, limit=INSIGHTS_LIMIT):
    """Run one Insights query and block until it finishes."""
    qid = logs.start_query(
        logGroupName=group,
        startTime=int(start.timestamp()),
        endTime=int(end.timestamp()),
        queryString=query,
        limit=limit,
    )["queryId"]
    while True:
        r = logs.get_query_results(queryId=qid)
        if r["status"] in ("Complete", "Failed", "Cancelled", "Timeout"):
            break
        time.sleep(1)
    if r["status"] != "Complete":
        raise RuntimeError(f"query {r['status']}: {query.strip()[:80]}")
    return [{f["field"]: f["value"] for f in row} for row in r["results"]], r["statistics"]


def fetch_records(logs, group, start, end):
    """Pull raw WAF log records, splitting the window whenever we hit the cap.

    Insights caps a result set at 10k rows, and a truncated pull would silently
    understate every count below, so a full window is split rather than trusted.
    """
    rows, _ = run_query(
        logs, group, start, end,
        "fields @message | filter ispresent(action) | sort @timestamp asc",
    )
    if len(rows) < INSIGHTS_LIMIT:
        return [json.loads(r["@message"]) for r in rows if "@message" in r]

    span = (end - start) / 2
    if span < timedelta(minutes=1):
        print(f"  ! dense window {start:%F %H:%M}, truncated at {INSIGHTS_LIMIT}", file=sys.stderr)
        return [json.loads(r["@message"]) for r in rows if "@message" in r]
    mid = start + span
    return fetch_records(logs, group, start, mid) + fetch_records(logs, group, mid, end)


def matched_rules(rec):
    """Every rule name this record matched, terminating or Count."""
    names = set()
    term = rec.get("terminatingRuleId")
    if term and term != "Default_Action":
        names.add(term)
    for r in rec.get("nonTerminatingMatchingRules") or []:
        if r.get("ruleId"):
            names.add(r["ruleId"])
    for r in rec.get("rateBasedRuleList") or []:
        if r.get("rateBasedRuleName"):
            names.add(r["rateBasedRuleName"])
    return names


def managed_matches(rec):
    """Sub-rules matched inside a managed rule group, e.g. AnonymousIpList."""
    out = set()
    for g in rec.get("ruleGroupList") or []:
        gid = g.get("ruleGroupId") or ""
        tag = gid.rsplit("#", 1)[-1] or gid
        for r in (g.get("nonTerminatingMatchingRules") or []):
            if r.get("ruleId"):
                out.add((tag, r["ruleId"]))
        tr = g.get("terminatingRule")
        if tr and tr.get("ruleId"):
            out.add((tag, tr["ruleId"]))
    return out


def analyse(records):
    """Everything the report needs, in one pass over the records."""
    a = {
        "total": len(records),
        "rule_hits": Counter(),
        "rule_ips": defaultdict(set),
        "managed": Counter(),
        "managed_ips": defaultdict(set),
        "ips": set(),
        "api_uris": Counter(),
        "buckets": Counter(),       # (ip, window) -> requests on the API path
        "ip_uri_mix": defaultdict(set),
        "ip_total": Counter(),
        "first": None,
        "last": None,
    }
    for rec in records:
        ts = rec.get("timestamp")
        if ts:
            ts = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
            a["first"] = min(a["first"] or ts, ts)
            a["last"] = max(a["last"] or ts, ts)
        req = rec.get("httpRequest") or {}
        ip = req.get("clientIp") or "?"
        uri = req.get("uri") or "?"
        a["ips"].add(ip)
        a["ip_total"][ip] += 1

        for name in matched_rules(rec):
            a["rule_hits"][name] += 1
            a["rule_ips"][name].add(ip)
        for tag, sub in managed_matches(rec):
            a["managed"][f"{tag}/{sub}"] += 1
            a["managed_ips"][f"{tag}/{sub}"].add(ip)

        if uri.startswith(API_PREFIX):
            a["api_uris"][uri.split("?", 1)[0]] += 1
            a["ip_uri_mix"][ip].add(uri.split("?", 1)[0])
            if ts:
                window = int(ts.timestamp()) // RATE_WINDOW_SEC
                a["buckets"][(ip, window)] += 1
    return a


def pct(sorted_vals, p):
    if not sorted_vals:
        return 0
    k = max(0, min(len(sorted_vals) - 1, int(round((p / 100) * (len(sorted_vals) - 1)))))
    return sorted_vals[k]


def report(env, days, a, known):
    W = 78
    def rule(ch="-"):
        print(ch * W)

    rule("=")
    print(f"FRONT-DOOR WAF SOAK — {env}  ({days} days, to {datetime.now(timezone.utc):%F %H:%M} UTC)")
    rule("=")

    if not a["total"]:
        print("\nNo WAF log records in this window. Nothing to read.\n")
        return

    span = (a["last"] - a["first"]) if a["first"] else timedelta(0)
    print(f"\nCOVERAGE — is there enough traffic here to conclude anything?")
    print(f"  requests           {a['total']:,}")
    print(f"  distinct client IPs{a['ips'].__len__():>8,}")
    print(f"  first / last       {a['first']:%F %H:%M} .. {a['last']:%F %H:%M} UTC ({span.days}d)")
    print(f"  API path requests  {sum(a['api_uris'].values()):,} on {API_PREFIX}")

    rule()
    print("PER-RULE — what each Count rule would have blocked\n")
    print(f"  {'rule':<24}{'requests':>12}{'distinct IPs':>14}")
    if not known:
        print("  (no ACL found for this env — showing only rules seen in the logs)")
        known = sorted(a["rule_hits"])
    for name in known:
        hits = a["rule_hits"].get(name, 0)
        ips = len(a["rule_ips"].get(name, ()))
        flag = "" if hits else "   (never matched)"
        print(f"  {name:<24}{hits:>12,}{ips:>14,}{flag}")
    extra = set(a["rule_hits"]) - set(known)
    for name in sorted(extra):
        print(f"  {name:<24}{a['rule_hits'][name]:>12,}{len(a['rule_ips'][name]):>14,}   (unlisted)")

    if a["managed"]:
        rule()
        print("MANAGED GROUP DETAIL — which AnonymousIpList sub-rule fired\n")
        for k, n in a["managed"].most_common():
            print(f"  {k:<44}{n:>10,}  {len(a['managed_ips'][k]):>6} IPs")

    rule()
    print(f"RATE — per-IP requests per {RATE_WINDOW_SEC // 60}-minute window on {API_PREFIX}\n")
    vals = sorted(a["buckets"].values())
    if vals:
        print(f"  windows observed   {len(vals):,}")
        for p in (50, 90, 99, 99.9):
            print(f"  p{p:<17}{pct(vals, p):>10,}")
        print(f"  max                {vals[-1]:>10,}")
        print(f"\n  Current rule: 2,000 per 5 min across all of {API_PREFIX} (Count).")
        headroom = pct(vals, 99.9)
        print(f"  Busiest legitimate-looking window is {vals[-1]:,}; p99.9 is {headroom:,}.")
    else:
        print("  No requests on the API path — the rate rule has nothing to read.")

    if a["api_uris"]:
        rule()
        print("PATH MIX — what is actually being polled\n")
        for uri, n in a["api_uris"].most_common(12):
            print(f"  {n:>10,}  {uri}")

    rule()
    print("HEAVIEST CLIENTS — volume, and how many distinct endpoints each touches\n")
    print(f"  {'client IP':<40}{'requests':>10}{'endpoints':>11}")
    for ip, n in a["ip_total"].most_common(12):
        print(f"  {ip:<40}{n:>10,}{len(a['ip_uri_mix'].get(ip, ())):>11}")
    rule("=")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--env", required=True, choices=sorted(ENV_ACCOUNTS))
    ap.add_argument("--days", type=int, default=28, help="lookback window (default 28)")
    ap.add_argument("--profile", help="AWS profile (default: ambient credentials)")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=REGION)

    acct = session.client("sts").get_caller_identity()["Account"]
    if acct != ENV_ACCOUNTS[args.env]:
        sys.exit(f"account {acct} is not {args.env}'s ({ENV_ACCOUNTS[args.env]}) — wrong credentials")

    logs = session.client("logs")
    group = log_group(args.env)
    try:
        logs.describe_log_groups(logGroupNamePrefix=group)["logGroups"][0]
    except IndexError:
        sys.exit(f"no log group {group} in {acct} — is {args.env} provisioned and logging?")

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=args.days)
    records = fetch_records(logs, group, start, end)
    a = analyse(records)

    if args.json:
        print(json.dumps({
            "env": args.env, "days": args.days, "total": a["total"],
            "distinct_ips": len(a["ips"]),
            "rule_hits": dict(a["rule_hits"]),
            "rule_ips": {k: len(v) for k, v in a["rule_ips"].items()},
            "managed": dict(a["managed"]),
            "rate_buckets": sorted(a["buckets"].values()),
            "api_uris": dict(a["api_uris"]),
        }, indent=2, default=str))
    else:
        report(args.env, args.days, a, acl_rule_names(session, args.env))


if __name__ == "__main__":
    main()
