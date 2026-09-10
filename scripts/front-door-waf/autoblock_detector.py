#!/usr/bin/env python3
"""
autoblock_detector.py — find pure-scraper clients at the edge and ban them, for
a while, via the front-door WAF's edge-autoblock IPSets.

This is the producer for edge-autoblock. provision_waf.py creates that IPSet and
the rule that references it; nothing wrote to it until this existed.

Ported from DUP's detect-single-endpoint-scrapers (acct 903440248568), but the
plumbing is rebuilt rather than copied. Two things change, and both matter:

  ATTRIBUTION. DUP's detector reads the regional WAF log, where clientIp is the
  CloudFront edge address, so it groups every visitor into ~170 POPs. Reading
  the forwarded chain instead fixes the grouping but lands on a caller-supplied
  header — and a blocker that trusts one lets an attacker name someone else as
  the culprit. This reads the CLOUDFRONT-scope log, where clientIp is the TCP
  peer and cannot be forged. There is no forwarded-IP handling here on purpose.

  SIGNAL. DUP scores volume on a single endpoint. That identifies whoever polls
  hardest, which is not the population we care about: its heaviest client of the
  week made ~71k requests, took zero passes, and paced itself under every
  workable rate limit. What separates a scraper from a crowd is conversion —
  availability reads that never turn into a booking attempt. Volume only decides
  whether there is enough evidence to judge.

WHAT IS NOT IN THIS FILE: which operators are hosting or VPN, the thresholds,
and the allowlist. This repository is public and that list is the defence — it
says which networks are safe to rent. It lives in SSM per account, read at run
time. See load_policy().

USAGE:
  python3 autoblock_detector.py --env dev                 # DRY RUN, prints candidates
  python3 autoblock_detector.py --env dev --apply         # write history, no blocks
  python3 autoblock_detector.py --env dev --apply --enforce   # also write the IPSets

Requires: boto3; creds for the target env's account. Standard library otherwise,
so this runs as a Lambda with nothing bundled.
"""
import argparse
import ipaddress
import json
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict

ENV_ACCOUNTS = {"dev": "623829546818", "test": "623829546818", "prod": "628373393242"}
REGION = "us-east-1"            # CLOUDFRONT scope is always us-east-1
POLICY_REGION = "ca-central-1"  # where SSM and DynamoDB live
TENANT_API_PREFIX = "/dayuse/api/"

POLICY_SSM_PATH = "/reserveRecPublic/{env}/frontDoorWaf/autoblock"

IPSET_V4 = "edge-autoblock"
IPSET_V6 = "edge-autoblock-v6"

# One row per banned address: why it was banned, and when the ban lapses. A WAF
# IPSet holds addresses and nothing else, so without this the reason a range is
# blocked exists only in whoever's memory added it.
HISTORY_TABLE = "{app}-{env}-waf-autoblock"

# offence number within the lookback -> ban length. Repeat offenders earn longer
# bans; the cap keeps a permanent ban from arriving by accident.
ESCALATION_SEC = [3600, 4 * 3600, 24 * 3600, 24 * 3600]
HISTORY_TTL_DAYS = 7

RDAP_SERVERS = [
    "https://rdap.arin.net/registry/ip/",
    "https://rdap.db.ripe.net/ip/",
    "https://rdap.apnic.net/ip/",
    "https://rdap.lacnic.net/rdap/ip/",
    "https://rdap.afrinic.net/rdap/ip/",
]

# Families that are never banned, whatever they score. Each is one address in
# front of many people: banning it takes out the bystanders, and the bystanders
# are the ones who complain. Kept as code rather than policy because these are
# the safety rails, not a tuning knob.
NEVER_BAN = ("privacy-proxy", "mobile-cgn", "institution")


def now():
    return int(time.time())


# ── policy ───────────────────────────────────────────────────────────────────

def load_policy(env, session=None):
    """Operator families, thresholds and allowlist from SSM.

    Exits rather than falling back to a default: a silent default is how the
    list gets back into this repository.
    """
    import boto3
    ssm = (session or boto3).client("ssm", region_name=POLICY_REGION)
    path = POLICY_SSM_PATH.format(env=env)
    try:
        raw = ssm.get_parameter(Name=path)["Parameter"]["Value"]
    except ssm.exceptions.ParameterNotFound:
        sys.exit(f"missing {path} in {POLICY_REGION} — the operator families and "
                 f"thresholds live in SSM, not in this repo. Seed it first.")
    policy = json.loads(raw)
    for key in ("operatorFamilies", "thresholds"):
        if key not in policy:
            sys.exit(f"{path} has no {key}")
    return policy


def classify(rdap_name, families):
    """Map an RDAP org/handle string to an operator family.

    Order matters and comes from the policy document: privacy-proxy has to be
    tested before datacenter, because a relay's ASN reads like hosting and
    suppression must win.
    """
    hay = (rdap_name or "").lower()
    for family, needles in families.items():
        if any(n.lower() in hay for n in needles):
            return family
    return "unknown"


# ── RDAP, cached by prefix ───────────────────────────────────────────────────

def rdap_lookup(addr):
    for base in RDAP_SERVERS:
        try:
            req = urllib.request.Request(base + addr, headers={"Accept": "application/rdap+json"})
            with urllib.request.urlopen(req, timeout=8) as r:
                d = json.loads(r.read())
            name = d.get("name") or ""
            for ent in d.get("entities", []) or []:
                for item in (ent.get("vcardArray") or [None, []])[1]:
                    if item and item[0] == "fn":
                        name = f"{name} {item[3]}"
            handles = " ".join(e.get("handle", "") for e in d.get("entities", []) or [])
            return {"name": f"{name} {handles}".strip()}
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError, TimeoutError):
            continue
    return {"name": "", "error": True}


def cache_key(addr):
    """Group the cache by network, not by address — a scraper rotates within a
    prefix and every address in it resolves to the same operator."""
    a = ipaddress.ip_address(addr)
    net = ipaddress.ip_network(f"{addr}/{24 if a.version == 4 else 48}", strict=False)
    return str(net)


# ── the query ────────────────────────────────────────────────────────────────

def build_query(thresholds):
    """Per-client conversion over the tenant API.

    clientIp at CLOUDFRONT scope is the viewer's own address. Grouping on it is
    correct here and is the whole reason this runs against the edge log.
    """
    return '''filter action = "ALLOW" and strcontains(httpRequest.uri, "%s")
| fields httpRequest.clientIp as client_ip,
         (httpRequest.httpMethod = "POST" and strcontains(httpRequest.uri, "%sbookings")) as is_booking,
         strcontains(httpRequest.uri, "%sproduct-dates/") as is_avail
| stats count() as total_reqs,
        sum(is_avail) as avail_reads,
        sum(is_booking) as booking_attempts,
        count_distinct(httpRequest.uri) as distinct_uris
      by client_ip
| filter avail_reads >= %d
| sort avail_reads desc
| limit %d''' % (TENANT_API_PREFIX, TENANT_API_PREFIX, TENANT_API_PREFIX,
                 thresholds["minAvailReads"], thresholds.get("topN", 200))


def run_query(logs, group, query, hours):
    end = now()
    qid = logs.start_query(logGroupName=group, startTime=end - hours * 3600,
                           endTime=end, queryString=query, limit=10000)["queryId"]
    deadline = time.time() + 120
    while time.time() < deadline:
        time.sleep(2)
        r = logs.get_query_results(queryId=qid)
        if r["status"] == "Complete":
            return [{f["field"]: f["value"] for f in row if f["field"] != "@ptr"}
                    for row in r["results"]]
        if r["status"] in ("Failed", "Cancelled"):
            raise RuntimeError(f"Insights query {r['status']}: {r.get('statistics')}")
    try:
        logs.stop_query(queryId=qid)
    except Exception:
        pass
    raise TimeoutError("Insights query did not complete in 120s")


# ── judgement ────────────────────────────────────────────────────────────────

def judge(row, family, thresholds):
    """Return (verdict, reason). Verdict is BLOCK, WATCH or '' for no action.

    Conversion is the discriminator; volume only establishes there is enough to
    judge. A client that reads availability heavily and never once tries to book
    is doing something other than planning a trip.
    """
    avail = int(row["avail_reads"])
    books = int(row["booking_attempts"])
    uris = int(row["distinct_uris"])
    conversion = books / avail if avail else 0.0

    if family in NEVER_BAN:
        return "", f"{family} is never banned"
    if conversion >= thresholds["conversionFloor"]:
        return "", f"converts at {conversion:.3f}"

    # A browser loads a page's worth of endpoints; a scraper usually wants one.
    # Narrow endpoint spread is corroboration, not the test on its own.
    narrow = uris <= thresholds["maxDistinctUris"]

    if family == "datacenter" and avail >= thresholds["datacenterAvailReads"]:
        return "BLOCK", f"datacenter, {avail} availability reads, {books} booking attempts"
    if family == "consumer-vpn" and avail >= thresholds["vpnAvailReads"] and narrow:
        return "BLOCK", f"consumer VPN, {avail} availability reads, {books} booking attempts"
    if family == "residential-isp" and avail >= thresholds["residentialAvailReads"] and narrow:
        # Residential is where the bystander risk is: one address can be a
        # household or a building. Never auto-banned, only surfaced.
        return "WATCH", f"residential, {avail} availability reads, {books} booking attempts"
    if avail >= thresholds["unknownAvailReads"] and narrow:
        return "WATCH", f"unclassified ({family}), {avail} availability reads"
    return "", "below thresholds"


# ── history and expiry ───────────────────────────────────────────────────────

def offences_in_window(item, window_sec):
    seen = json.loads(item.get("offences", {}).get("S", "[]"))
    return len([t for t in seen if t >= now() - window_sec])


def ban_seconds(offence_count):
    idx = min(max(offence_count, 1), len(ESCALATION_SEC)) - 1
    return ESCALATION_SEC[idx]


def record_offence(ddb, table, addr, family, reason, duration):
    """Write the ban and the reason for it.

    The reason is the point of this table. It is also why the table is here and
    not in git: it names operators and the investigation behind them.
    """
    key = {"ip": {"S": addr}}
    try:
        cur = ddb.get_item(TableName=table, Key=key).get("Item", {})
    except Exception:
        cur = {}
    seen = json.loads(cur.get("offences", {}).get("S", "[]"))
    seen.append(now())
    seen = seen[-20:]
    expires = now() + duration
    ddb.put_item(TableName=table, Item={
        "ip": {"S": addr},
        "family": {"S": family},
        "reason": {"S": reason},
        "offences": {"S": json.dumps(seen)},
        "bannedAt": {"N": str(now())},
        "expiresAt": {"N": str(expires)},
        "ttl": {"N": str(now() + HISTORY_TTL_DAYS * 86400)},
    })
    return expires


def active_bans(ddb, table):
    """Addresses whose ban has not lapsed.

    The IPSet is rebuilt from this every run, so an expired ban disappears by
    not being rewritten. DUP's entries were left behind in the migration for
    exactly this reason: they are time-limited bans, and copying them into an
    estate with no expirer would have made them permanent.
    """
    live, t = set(), now()
    paginator = ddb.get_paginator("scan")
    for page in paginator.paginate(TableName=table,
                                   ProjectionExpression="ip, expiresAt"):
        for item in page.get("Items", []):
            if int(item.get("expiresAt", {}).get("N", "0")) > t:
                live.add(item["ip"]["S"])
    return live


def write_ipsets(waf, addrs, enforce):
    """Rebuild both IPSets from the active bans.

    Both, because edge-autoblock is IPv4-only and the majority of this estate's
    request volume is IPv6 — a v4-only producer cannot act on its heaviest
    clients, which is the same dead end DUP's detector reached by another route.
    """
    by_version = defaultdict(list)
    for a in addrs:
        v = ipaddress.ip_address(a).version
        by_version[v].append(f"{a}/{32 if v == 4 else 128}")

    existing = {s["Name"]: s for s in waf.list_ip_sets(Scope="CLOUDFRONT")["IPSets"]}
    for name, version in ((IPSET_V4, 4), (IPSET_V6, 6)):
        if name not in existing:
            print(f"    !! {name}: IPSet missing — run provision_waf.py first; skipping")
            continue
        want = sorted(by_version[version])
        if not enforce:
            print(f"    would write {name}: {len(want)} address(es)")
            continue
        cur = waf.get_ip_set(Name=name, Scope="CLOUDFRONT", Id=existing[name]["Id"])
        waf.update_ip_set(Name=name, Scope="CLOUDFRONT", Id=existing[name]["Id"],
                          LockToken=cur["LockToken"], Addresses=want)
        print(f"    wrote {name}: {len(want)} address(es)")


# ── main ─────────────────────────────────────────────────────────────────────

def detect(env, app, apply_changes=False, enforce=False, hours=24, session=None):
    import boto3
    sess = session or boto3
    acct = sess.client("sts").get_caller_identity()["Account"]
    if acct != ENV_ACCOUNTS[env]:
        sys.exit(f"WRONG ACCOUNT: creds are {acct}, --env {env} needs {ENV_ACCOUNTS[env]}. Aborting.")

    policy = load_policy(env, sess)
    families = policy["operatorFamilies"]
    thresholds = policy["thresholds"]
    allow = [ipaddress.ip_network(n) for n in policy.get("allowlist", [])]

    logs = sess.client("logs", region_name=REGION)
    waf = sess.client("wafv2", region_name=REGION)
    ddb = sess.client("dynamodb", region_name=POLICY_REGION)
    table = HISTORY_TABLE.format(app=app, env=env)

    group = f"aws-waf-logs-reserve-rec-front-door-{env}"
    rows = run_query(logs, group, build_query(thresholds), hours)
    print(f"  {len(rows)} client(s) over the read threshold in {hours}h")

    rdap_cache, candidates = {}, []
    for row in rows:
        addr = row["client_ip"]
        try:
            parsed = ipaddress.ip_address(addr)
        except ValueError:
            continue
        if any(parsed in n for n in allow):
            continue

        key = cache_key(addr)
        if key not in rdap_cache:
            rdap_cache[key] = rdap_lookup(addr)
        family = classify(rdap_cache[key].get("name"), families)

        verdict, reason = judge(row, family, thresholds)
        if verdict:
            candidates.append({"ip": addr, "family": family, "verdict": verdict,
                               "reason": reason, **row})

    for c in candidates:
        print(f"    {c['verdict']:<6} {c['ip']:<40} {c['family']:<16} {c['reason']}")

    if not apply_changes:
        print("\nDRY RUN — nothing written. Re-run with --apply.")
        return {"candidates": len(candidates), "banned": 0}

    banned = 0
    for c in candidates:
        if c["verdict"] != "BLOCK":
            continue
        item = ddb.get_item(TableName=table, Key={"ip": {"S": c["ip"]}}).get("Item", {})
        count = offences_in_window(item, 24 * 3600) + 1
        record_offence(ddb, table, c["ip"], c["family"], c["reason"], ban_seconds(count))
        banned += 1

    write_ipsets(waf, active_bans(ddb, table), enforce)
    if not enforce:
        print("  SHADOW MODE — history written, IPSets untouched. Pass --enforce to ban.")
    return {"candidates": len(candidates), "banned": banned}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Find scraper clients at the front-door edge")
    ap.add_argument("--env", required=True, choices=ENV_ACCOUNTS.keys())
    ap.add_argument("--app", default="reserve-rec", help="app name prefix on the history table")
    ap.add_argument("--apply", action="store_true", help="write ban history (default: dry run)")
    ap.add_argument("--enforce", action="store_true", help="also write the IPSets")
    ap.add_argument("--hours", type=int, default=24, help="lookback window (default 24)")
    args = ap.parse_args()
    print(f"env={args.env} window={args.hours}h apply={args.apply} enforce={args.enforce}\n")
    detect(args.env, args.app, args.apply, args.enforce, args.hours)
