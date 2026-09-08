#!/usr/bin/env python3
"""
datacenter_feed.py — refresh cloud/VPS provider IP ranges into the front-door
edge WAF's dc-<provider>-v4/v6 IPSets.

This is the runtime-data companion to provision_waf.py. provision_waf.py creates
the IPSets (empty) and the dc-<provider> rules; this script fills the IPSets with
current provider ranges and (re)points each dc-<provider> rule at them, in Count
or Block per --block. Run it on a schedule (provider ranges drift weekly).

Ported from the dup-datacenter-ipsets tooling (which maintains DUP's dup-edge-ja
in acct 903440248568). The provider fetchers are identical; the target WebACL is
parameterized by --env so the same code serves reserve-rec dev/test/prod — and,
during transition, can be pointed at DUP too.

USAGE:
  python3 datacenter_feed.py --env dev                     # DRY RUN
  python3 datacenter_feed.py --env dev --apply             # push, all providers COUNT
  python3 datacenter_feed.py --env dev --apply --block all # all providers BLOCK
  python3 datacenter_feed.py --env dev --apply --block aws,gcp,azure,oracle

Requires: boto3, netaddr; creds for the target env's account.
"""
import argparse
import json
import sys
import urllib.request
from netaddr import cidr_merge, IPSet

from provision_waf import load_providers

ENV_ACCOUNTS = {"dev": "623829546818", "test": "623829546818", "prod": "628373393242"}
REGION = "us-east-1"
MAX_PER_IPSET = 10000


def http(url, ua="Mozilla/5.0"):
    req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept": "application/json,*/*"})
    return urllib.request.urlopen(req, timeout=40).read()


def ripe_asn(asn):
    d = json.loads(http(f"https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS{asn}", "curl/8"))
    return [p["prefix"] for p in d["data"]["prefixes"]]


def fetch_aws():
    # EC2 (where bots run) MINUS CloudFront ranges — never block our own edge.
    d = json.loads(http("https://ip-ranges.amazonaws.com/ip-ranges.json"))
    CF = ("CLOUDFRONT", "CLOUDFRONT_ORIGIN_FACING")
    ec2_4 = IPSet([p["ip_prefix"] for p in d["prefixes"] if p["service"] == "EC2"])
    cf_4 = IPSet([p["ip_prefix"] for p in d["prefixes"] if p["service"] in CF])
    ec2_6 = IPSet([p["ipv6_prefix"] for p in d["ipv6_prefixes"] if p["service"] == "EC2"])
    cf_6 = IPSet([p["ipv6_prefix"] for p in d["ipv6_prefixes"] if p["service"] in CF])
    return [str(c) for c in (ec2_4 - cf_4).iter_cidrs()], [str(c) for c in (ec2_6 - cf_6).iter_cidrs()]


def fetch_gcp():
    d = json.loads(http("https://www.gstatic.com/ipranges/cloud.json"))
    return ([p["ipv4Prefix"] for p in d["prefixes"] if "ipv4Prefix" in p],
            [p["ipv6Prefix"] for p in d["prefixes"] if "ipv6Prefix" in p])


def fetch_oracle():
    d = json.loads(http("https://docs.oracle.com/iaas/tools/public_ip_ranges.json"))
    cidrs = [c["cidr"] for r in d["regions"] for c in r["cidrs"]]
    return [c for c in cidrs if ":" not in c], [c for c in cidrs if ":" in c]


def _asn_provider(*asns):
    def fn():
        pre = []
        for asn in asns:
            try:
                pre += ripe_asn(asn)
            except Exception as e:
                print(f"    AS{asn} fetch err: {e}", file=sys.stderr)
        if not pre:
            raise RuntimeError(f"no prefixes for {asns}")
        return [p for p in pre if ":" not in p], [p for p in pre if ":" in p]
    return fn


# Fetch mechanisms, keyed by source type. WHICH providers use them, and the
# ASNs behind them, come from SSM at run time — this repo is public and must not
# name what we block. Providers whose ranges come from a published file get a
# fetcher here; everything else resolves by ASN.
SOURCES = {"aws": fetch_aws, "gcp": fetch_gcp, "oracle": fetch_oracle}


def build_fetchers(providers):
    """{name: callable} for the providers SSM lists, or exit saying which failed."""
    out = {}
    for p in providers:
        name, src = p.get("name"), p.get("source")
        if not name or not src:
            sys.exit(f"malformed provider entry: {p}")
        if src == "asn":
            if not p.get("asns"):
                sys.exit(f"provider {name}: source 'asn' needs a non-empty asns list")
            out[name] = _asn_provider(*p["asns"])
        elif src in SOURCES:
            out[name] = SOURCES[src]
        else:
            sys.exit(f"provider {name}: unknown source {src!r} "
                     f"(known: asn, {', '.join(sorted(SOURCES))})")
    return out


def merged(lst):
    return [str(n) for n in cidr_merge(lst)]


def collect(fetchers):
    out = {}
    for name, fn in fetchers.items():
        try:
            v4, v6 = fn()
            out[name] = {"v4": merged(v4), "v6": merged(v6)}
            print(f"  {name:12} v4={len(out[name]['v4']):6}  v6={len(out[name]['v6']):6}")
        except Exception as e:
            print(f"  {name:12} FETCH FAILED: {e}  (existing IPSet left unchanged)")
            out[name] = None
    return out


def apply(env, data):
    import boto3
    acct = boto3.client("sts").get_caller_identity()["Account"]
    if acct != ENV_ACCOUNTS[env]:
        sys.exit(f"WRONG ACCOUNT: creds are {acct}, --env {env} needs {ENV_ACCOUNTS[env]}. Aborting.")
    waf = boto3.client("wafv2", region_name=REGION)
    existing = {s["Name"]: s for s in waf.list_ip_sets(Scope="CLOUDFRONT")["IPSets"]}

    def upsert(name, addrs):
        # IPSet must already exist (created by provision_waf.py). Never create here —
        # the ruleset that references it is owned by the provisioner.
        if name not in existing:
            print(f"    !! {name}: IPSet missing — run provision_waf.py first; skipping")
            return
        if len(addrs) > MAX_PER_IPSET:
            print(f"    !! {name}: {len(addrs)} > {MAX_PER_IPSET} cap — TRUNCATING")
            addrs = addrs[:MAX_PER_IPSET]
        cur = waf.get_ip_set(Name=name, Scope="CLOUDFRONT", Id=existing[name]["Id"])
        waf.update_ip_set(Name=name, Scope="CLOUDFRONT", Id=existing[name]["Id"],
                          LockToken=cur["LockToken"], Addresses=addrs)
        print(f"    updated {name} ({len(addrs)})")

    for prov, d in data.items():
        if d is None:
            continue
        upsert(f"dc-{prov}-v4", d["v4"])
        upsert(f"dc-{prov}-v6", d["v6"])
    print("  IPSets refreshed. Rule Count/Block actions are owned by provision_waf.py "
          "(--block dc); this script only refreshes IP contents.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Refresh datacenter IPSets on the front-door edge WAF")
    ap.add_argument("--env", required=True, choices=ENV_ACCOUNTS.keys())
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    fetchers = build_fetchers(load_providers(args.env))
    print(f"Fetching ranges for {len(fetchers)} providers (merged)...  "
          f"env={args.env}  apply={args.apply}")
    data = collect(fetchers)
    if not args.apply:
        print("\nDRY RUN — no AWS changes. Re-run with --apply.")
    else:
        print(f"\nApplying to reserve-rec-front-door-{args.env} ({ENV_ACCOUNTS[args.env]} {REGION})...")
        apply(args.env, data)
