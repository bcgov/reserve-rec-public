#!/usr/bin/env python3
"""
provision_waf.py — provision the reserve.bcparks.ca front-door edge WAF.

WHY A SCRIPT (not CDK): CloudFront-scope WAF lives in us-east-1, where the BCGov
LZA SCP (p-0olid24c) denies CloudFormation. Direct wafv2/logs API writes ARE
allowed (probe-verified 2026-08-11). So the edge WAF is provisioned by this
idempotent script; the ARN is written to ca-central-1 SSM and the front-door
CDK stack attaches it via its `webAclArn` config (the seam already exists).

This file is the SOURCE OF TRUTH for the ruleset. The WebACL is fully
reproducible by re-running the script; rule/action changes arrive as reviewed
PRs. IP *contents* are runtime state managed by datacenter_feed.py (this
creates the IPSets empty; the feed populates them).

Ruleset is a faithful port of DUP's dup-edge-ja (acct 903440248568), adapted
for the front door: the JA4 capture rule is scoped to the /dayuse tenant's API
prefix rather than /api. Geo restriction is NOT here — it lives on the
distribution (front-door-stack.js). The DUP `allow-staff-checkin` rule is
dropped: it is DUP-pass-specific (PUT /api/pass…) with no reserve-rec analogue.

USAGE:
  # DRY RUN — show what would change, no writes:
  python3 provision_waf.py --env dev

  # APPLY — create/update WebACL + IPSets + logging, write ARN to SSM:
  python3 provision_waf.py --env dev --apply

  # Datacenter/reputation/anon rules ship in COUNT mode by default so they can
  # soak against real traffic. Promote to Block explicitly, per rule group:
  python3 provision_waf.py --env dev --apply --block dc,reputation,autoblock,anon

Requires: boto3; creds for the target env's account
  (dev/test 623829546818, prod 628373393242) in the environment.
"""
import argparse
import json
import sys

# ── environment → account (guardrail: refuse to write to the wrong account) ──
ENV_ACCOUNTS = {
    "dev":  "623829546818",
    "test": "623829546818",
    "prod": "628373393242",
}
REGION = "us-east-1"          # CLOUDFRONT scope is always us-east-1
TENANT_API_PREFIX = "/dayuse/api/"   # day-use tenant; JA4 capture is scoped here

# ── datacenter providers → the IPSets datacenter_feed.py populates ───────────
# Each provider gets its own dc-<name>-v4/v6 IPSet + dc-<name> rule so they can
# be tuned/promoted individually. Kept in lockstep with datacenter_feed.py.
DC_PROVIDERS = [
    "aws", "gcp", "oracle", "azure", "hetzner",
    "ovh", "digitalocean", "linode", "vultr", "m247",
]

# ── standalone IPSets (populated out of band by ops tooling / investigations) ─
STANDALONE_IPSETS = [
    ("edge-autoblock",   "IPV4"),   # watchlist / investigation-driven blocks
    ("edge-reputation",  "IPV4"),   # reputation-feed mirror
]

# base64('/dayuse/api/') — WAF ByteMatch SearchString is base64 in the API.
import base64
_JA4_PREFIX_B64 = base64.b64encode(TENANT_API_PREFIX.encode()).decode()


def acl_name(env):
    return f"reserve-rec-front-door-{env}"


def log_group_name(env):
    return f"aws-waf-logs-reserve-rec-front-door-{env}"


def vis(metric):
    return {"SampledRequestsEnabled": True, "CloudWatchMetricsEnabled": True, "MetricName": metric}


def build_rules(ipset_arns, block):
    """Return the ordered WebACL rule list from declarative config.

    ipset_arns: {name: arn} for every IPSet this ACL references.
    block: set of rule-group keys to ship in Block (others ship in Count).
    """
    def action(group):
        return {"Block": {}} if group in block else {"Count": {}}

    rules = []

    # Priority 0 — JA4 fingerprint capture on the tenant API. Always Count: this
    # is telemetry (feeds bot investigations via the WAF logs), never a block.
    rules.append({
        "Name": "capture-ja",
        "Priority": 0,
        "Action": {"Count": {}},
        "Statement": {"AndStatement": {"Statements": [
            {"RegexMatchStatement": {
                "RegexString": ".",
                "FieldToMatch": {"JA4Fingerprint": {"FallbackBehavior": "MATCH"}},
                "TextTransformations": [{"Priority": 0, "Type": "NONE"}],
            }},
            {"ByteMatchStatement": {
                "SearchString": _JA4_PREFIX_B64,
                "FieldToMatch": {"UriPath": {}},
                "TextTransformations": [{"Priority": 0, "Type": "NONE"}],
                "PositionalConstraint": "STARTS_WITH",
            }},
        ]}},
        "VisibilityConfig": vis("captureJa"),
    })

    # Priority 10–19 — per-provider datacenter blocks.
    for i, prov in enumerate(DC_PROVIDERS):
        refs = [{"IPSetReferenceStatement": {"ARN": ipset_arns[n]}}
                for n in (f"dc-{prov}-v4", f"dc-{prov}-v6") if n in ipset_arns]
        if not refs:
            continue
        stmt = refs[0] if len(refs) == 1 else {"OrStatement": {"Statements": refs}}
        rules.append({
            "Name": f"dc-{prov}",
            "Priority": 10 + i,
            "Action": action("dc"),
            "Statement": stmt,
            "VisibilityConfig": vis(f"dc{prov}"),
        })

    # Priority 20/21 — reputation + autoblock IPSets.
    rules.append({
        "Name": "edge-reputation",
        "Priority": 20,
        "Action": action("reputation"),
        "Statement": {"IPSetReferenceStatement": {"ARN": ipset_arns["edge-reputation"]}},
        "VisibilityConfig": vis("edgeReputation"),
    })
    rules.append({
        "Name": "edge-autoblock",
        "Priority": 21,
        "Action": action("autoblock"),
        "Statement": {"IPSetReferenceStatement": {"ARN": ipset_arns["edge-autoblock"]}},
        "VisibilityConfig": vis("edgeAutoblock"),
    })

    # Priority 22 — AWS managed anonymous-IP (VPN/proxy/Tor) list. Managed groups
    # use OverrideAction: None = use the group's own actions (block); Count =
    # force count for soak.
    rules.append({
        "Name": "AnonymousIpList",
        "Priority": 22,
        "OverrideAction": ({"None": {}} if "anon" in block else {"Count": {}}),
        "Statement": {"ManagedRuleGroupStatement": {
            "VendorName": "AWS",
            "Name": "AWSManagedRulesAnonymousIpList",
        }},
        "VisibilityConfig": vis("anonymousIpList"),
    })

    # Priority 30 — per-IP rate limit on the tenant API. DUP had none; start in
    # Count and tune the threshold before promoting. Uses forwarded viewer IP so
    # it sees the real client, not the CloudFront edge.
    rules.append({
        "Name": "rate-dayuse-api",
        "Priority": 30,
        "Action": action("rate"),
        "Statement": {"RateBasedStatement": {
            "Limit": 2000,                 # requests / 5-min window / IP — tune before Block
            "AggregateKeyType": "IP",
            "ScopeDownStatement": {"ByteMatchStatement": {
                "SearchString": _JA4_PREFIX_B64,
                "FieldToMatch": {"UriPath": {}},
                "TextTransformations": [{"Priority": 0, "Type": "NONE"}],
                "PositionalConstraint": "STARTS_WITH",
            }},
        }},
        "VisibilityConfig": vis("rateDayuseApi"),
    })

    return rules


def main():
    ap = argparse.ArgumentParser(description="Provision the reserve-rec front-door edge WAF")
    ap.add_argument("--env", required=True, choices=ENV_ACCOUNTS.keys())
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    ap.add_argument("--block", default="",
                    help="comma-separated rule groups to ship in Block instead of Count: "
                         "dc,reputation,autoblock,anon,rate")
    args = ap.parse_args()

    block = {g.strip() for g in args.block.split(",") if g.strip()}
    valid = {"dc", "reputation", "autoblock", "anon", "rate"}
    bad = block - valid
    if bad:
        ap.error(f"unknown --block groups: {bad} (valid: {sorted(valid)})")

    import boto3
    sts = boto3.client("sts")
    acct = sts.get_caller_identity()["Account"]
    want = ENV_ACCOUNTS[args.env]
    if acct != want:
        sys.exit(f"WRONG ACCOUNT: creds are for {acct}, --env {args.env} needs {want}. Aborting.")

    name = acl_name(args.env)
    modes = ", ".join(f"{g}={'BLOCK' if g in block else 'COUNT'}"
                      for g in ("dc", "reputation", "autoblock", "anon", "rate"))
    print(f"env={args.env} account={acct} region={REGION}")
    print(f"WebACL={name}  actions: {modes}  apply={args.apply}\n")

    waf = boto3.client("wafv2", region_name=REGION)

    # 1. Ensure all IPSets exist (created empty; datacenter_feed.py populates).
    wanted_ipsets = ([(f"dc-{p}-v4", "IPV4") for p in DC_PROVIDERS]
                     + [(f"dc-{p}-v6", "IPV6") for p in DC_PROVIDERS]
                     + STANDALONE_IPSETS)
    existing = {s["Name"]: s for s in waf.list_ip_sets(Scope="CLOUDFRONT")["IPSets"]}
    ipset_arns = {}
    for ip_name, ver in wanted_ipsets:
        if ip_name in existing:
            ipset_arns[ip_name] = existing[ip_name]["ARN"]
            print(f"  ipset exists  {ip_name}")
        elif args.apply:
            r = waf.create_ip_set(Name=ip_name, Scope="CLOUDFRONT", IPAddressVersion=ver,
                                  Addresses=[], Description="reserve-rec front-door edge - populated by datacenter_feed.py")
            ipset_arns[ip_name] = r["Summary"]["ARN"]
            print(f"  ipset CREATE  {ip_name}")
        else:
            ipset_arns[ip_name] = f"arn:aws:wafv2:{REGION}:{acct}:global/ipset/{ip_name}/DRY-RUN"
            print(f"  ipset CREATE  {ip_name}  (dry-run)")

    # 2. Build rules and create/update the WebACL.
    rules = build_rules(ipset_arns, block)
    print(f"\n  rules ({len(rules)}): " + ", ".join(f"{r['Name']}@{r['Priority']}" for r in rules))

    acls = {a["Name"]: a for a in waf.list_web_acls(Scope="CLOUDFRONT")["WebACLs"]}
    acl_arn = None
    if not args.apply:
        print("\nDRY RUN — no WebACL/logging/SSM writes. Re-run with --apply.")
        return

    common = dict(
        Name=name, Scope="CLOUDFRONT",
        DefaultAction={"Allow": {}},
        Rules=rules,
        VisibilityConfig=vis(f"reserveRecFrontDoor{args.env.capitalize()}"),
    )
    if name in acls:
        cur = waf.get_web_acl(Name=name, Scope="CLOUDFRONT", Id=acls[name]["Id"])
        waf.update_web_acl(Id=acls[name]["Id"], LockToken=cur["LockToken"], **common)
        acl_arn = acls[name]["ARN"]
        print(f"\n  WebACL UPDATED  {name}")
    else:
        r = waf.create_web_acl(**common)
        acl_arn = r["Summary"]["ARN"]
        print(f"\n  WebACL CREATED  {name}")

    # 3. WAF logging → CloudWatch (JA4 capture is inert without it).
    logs = boto3.client("logs", region_name=REGION)
    lg = log_group_name(args.env)
    groups = logs.describe_log_groups(logGroupNamePrefix=lg)["logGroups"]
    if not any(g["logGroupName"] == lg for g in groups):
        logs.create_log_group(logGroupName=lg)
        logs.put_retention_policy(logGroupName=lg, retentionInDays=90)
        print(f"  log group CREATED  {lg} (90d retention)")
    else:
        print(f"  log group exists  {lg}")
    log_arn = f"arn:aws:logs:{REGION}:{acct}:log-group:{lg}:*"
    waf.put_logging_configuration(LoggingConfiguration={
        "ResourceArn": acl_arn,
        "LogDestinationConfigs": [log_arn],
    })
    print(f"  logging configured → {lg}")

    # 4. Write the WebACL ARN to ca-central-1 SSM for the CDK stack to attach.
    ssm = boto3.client("ssm", region_name="ca-central-1")
    ssm_path = f"/reserveRecPublic/{args.env}/frontDoorWaf/webAclArn"
    ssm.put_parameter(Name=ssm_path, Type="String", Overwrite=True, Value=acl_arn,
                      Description="Front-door edge WAF WebACL ARN (provisioned by provision_waf.py)")
    print(f"  SSM  {ssm_path} = {acl_arn}")

    print("\nDone. Next: set the front-door stack's webAclArn config to this SSM path "
          "and deploy; then run datacenter_feed.py to populate the IPSets.")


if __name__ == "__main__":
    main()
