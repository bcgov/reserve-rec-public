#!/usr/bin/env python3
"""
Saved CloudWatch Logs Insights queries for the front-door WAF log.

These are the queries every investigation starts with, kept here so they
exist in every environment and read the same way. Each is saved as
ops/<env>/<name>, scoped to that environment's WAF log group, and re-running
the script updates them in place.

The WAF log is the only place the true client address exists: behind
CloudFront the API's own access log records the edge address. So every
by-address question is answered here, in us-east-1, where CloudFormation is
denied - which is why this is a script, like provision_waf.py.

Usage:
    AWS_PROFILE=b74067-dev  python3 ops_queries.py --env dev --apply
    AWS_PROFILE=b74067-prod python3 ops_queries.py --env prod --apply
"""
import argparse
import sys

from provision_waf import ENV_ACCOUNTS, REGION, TENANT_API_PREFIX, log_group_name

# `headers` is an array, which Insights cannot address by name; parse the
# raw record for the header wanted instead. Case-insensitive on the name
# because CloudFront preserves whatever the client sent.
UA = r'parse @message /"name":"[Uu]ser-[Aa]gent","value":"(?<ua>[^"]*)"/'
HOST = r'parse @message /"name":"[Hh]ost","value":"(?<host>[^"]*)"/'
API = f'filter httpRequest.uri like "{TENANT_API_PREFIX}"'

QUERIES = {
    "top-booking-ips": (
        "Addresses attempting bookings, by attempts. The population any block "
        "is judged against.",
        f"""fields httpRequest.clientIp as ip
| {API}
| filter httpRequest.httpMethod = "POST" and httpRequest.uri like /\\/bookings/
| stats count(*) as attempts, min(@timestamp) as first, max(@timestamp) as last by ip
| sort attempts desc
| limit 50""",
    ),
    "top-read-ips": (
        "Addresses reading the API, by request count, with their booking "
        "attempts beside it. Volume without attempts is the shape of a watcher.",
        f"""fields httpRequest.clientIp as ip
| {API}
| stats count(*) as requests,
        sum(httpRequest.httpMethod = "POST" and httpRequest.uri like /\\/bookings/) as bookingAttempts,
        count_distinct(httpRequest.uri) as distinctPaths by ip
| sort requests desc
| limit 50""",
    ),
    "blocked-ips": (
        "Addresses the ACL blocked, and which rule did it.",
        """fields httpRequest.clientIp as ip
| filter action = "BLOCK"
| stats count(*) as blocked, count_distinct(terminatingRuleId) as rules,
        earliest(terminatingRuleId) as firstRule, latest(terminatingRuleId) as lastRule by ip
| sort blocked desc
| limit 50""",
    ),
    "terminating-rules": (
        "What each rule decided, in five-minute bins. Count-mode rules appear "
        "under nonTerminatingMatchingRules, not here.",
        """stats count(*) as requests by bin(5m), terminatingRuleId, action
| sort @timestamp desc""",
    ),
    "forensics-by-ip": (
        "Everything one address did. Replace the placeholder before running.",
        f"""fields @timestamp, action, terminatingRuleId, httpRequest.httpMethod as method, httpRequest.uri as uri, httpRequest.country as country
| {UA}
| filter httpRequest.clientIp = "0.0.0.0"
| sort @timestamp asc
| limit 1000""",
    ),
    "hosts": (
        "Host headers seen. Anything other than the front door's own names is "
        "a client that found the distribution by another route.",
        f"""{HOST}
| stats count(*) as requests, count_distinct(httpRequest.clientIp) as ips by host
| sort requests desc""",
    ),
    "ja4-fingerprints": (
        "TLS fingerprints on the API, with how many addresses share each. One "
        "fingerprint across many addresses is one client.",
        f"""fields ja4Fingerprint as ja4
| {API}
| filter ispresent(ja4)
| stats count(*) as requests, count_distinct(httpRequest.clientIp) as ips,
        sum(httpRequest.httpMethod = "POST" and httpRequest.uri like /\\/bookings/) as bookingAttempts by ja4
| sort requests desc
| limit 50""",
    ),
    "user-agents": (
        "User agents on the API. Scripts announce themselves here before "
        "anywhere else.",
        f"""{UA}
| {API}
| stats count(*) as requests, count_distinct(httpRequest.clientIp) as ips by ua
| sort requests desc
| limit 50""",
    ),
}


def main():
    ap = argparse.ArgumentParser(description="Save the ops/ Insights queries for one environment's WAF log")
    ap.add_argument("--env", required=True, choices=ENV_ACCOUNTS.keys())
    ap.add_argument("--apply", action="store_true", help="write (default: print what would change)")
    args = ap.parse_args()

    import boto3
    acct = boto3.client("sts").get_caller_identity()["Account"]
    if acct != ENV_ACCOUNTS[args.env]:
        sys.exit(f"WRONG ACCOUNT: creds are for {acct}, --env {args.env} needs {ENV_ACCOUNTS[args.env]}. Aborting.")

    logs = boto3.client("logs", region_name=REGION)
    group = log_group_name(args.env)
    prefix = f"ops/{args.env}/"
    existing = {}
    token = None
    while True:
        kw = {"queryDefinitionNamePrefix": prefix.rstrip("/")}
        if token:
            kw["nextToken"] = token
        page = logs.describe_query_definitions(**kw)
        existing.update({q["name"]: q for q in page["queryDefinitions"]})
        token = page.get("nextToken")
        if not token:
            break

    print(f"env={args.env} account={acct} region={REGION} logGroup={group} apply={args.apply}\n")
    for key, (_, query) in QUERIES.items():
        name = prefix + key
        current = existing.get(name)
        unchanged = current and current["queryString"] == query and current.get("logGroupNames") == [group]
        verb = "ok      " if unchanged else ("update  " if current else "create  ")
        print(f"  {verb}{name}")
        if unchanged or not args.apply:
            continue
        kw = {"name": name, "queryString": query, "logGroupNames": [group]}
        if current:
            kw["queryDefinitionId"] = current["queryDefinitionId"]
        logs.put_query_definition(**kw)

    stale = sorted(set(existing) - {prefix + k for k in QUERIES})
    for name in stale:
        print(f"  stale   {name}  (not managed here; delete by hand if unwanted)")


if __name__ == "__main__":
    main()
