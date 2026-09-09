# Front-door edge WAF

The `reserve.bcparks.ca` front door's edge WAF (CloudFront scope, us-east-1).

## Why these are scripts, not CDK

CloudFront-scope WAF resources must live in **us-east-1**, where the BCGov LZA
SCP (`p-0olid24c`) **denies CloudFormation**. Direct `wafv2` / `logs` API writes
are allowed (probe-verified). So the WAF is provisioned by API script; the
resulting WebACL ARN is written to **ca-central-1 SSM**, and the front-door CDK
stack attaches it via its `webAclArnSSMPath` config. See bcgov/reserve-rec-api#207.

## Files

| File | Role | In git? |
|---|---|---|
| `provision_waf.py` | **Source of truth for the ruleset.** Creates/updates the WebACL, IPSets (empty), WAF logging; writes the ARN to SSM. | ✅ rules, actions, structure |
| `datacenter_feed.py` | Runtime data. Refreshes the `dc-*` IPSets from live provider ranges. | ✅ mechanism (IP contents are runtime state, not git) |
| `soak_report.py` | **Read-only.** Reads the WAF logs and reports what each Count rule *would* have blocked, the observed per-IP rate distribution, and which rules never matched. Run it before promoting anything to Block. | ✅ |

## Ruleset (ported from DUP's `dup-edge-ja`)

| Pri | Rule | Default action |
|---|---|---|
| 0 | `capture-ja` — JA4 fingerprint capture on `/dayuse/api/` | Count (telemetry, never blocks) |
| 10–49 | `dc-<provider>` — one per provider, band sized for growth | Count → Block |
| 50 | `edge-reputation` | Count → Block |
| 51 | `edge-autoblock` (watchlist) | Count → Block |
| 52 | `AnonymousIpList` (AWS managed) | Count → Block |
| 60 | `rate-dayuse-api` — per-IP rate limit | Count → Block (tune threshold first) |

Providers are listed once, in `provision_waf.py`'s `DC_PROVIDERS`; the feed
imports that list and fails loudly if a provider there has no fetcher.

Geo restriction lives on the distribution (`front-door-stack.js`), not here.

## Workflow

```bash
# 1. dry run — inspect the plan
python3 provision_waf.py --env dev

# 2. apply — everything ships in COUNT to soak against real traffic
python3 provision_waf.py --env dev --apply

# 3. wire it in: set the front-door stack's webAclArnSSMPath config to
#    /reserveRecPublic/dev/frontDoorWaf/webAclArn and deploy

# 4. populate the datacenter IPSets
python3 datacenter_feed.py --env dev --apply

# 5. read the soak — what each rule would have blocked, and what never matched:
python3 soak_report.py --env dev --days 28

# 6. once the soak shows no false positives, promote to Block:
python3 provision_waf.py --env dev --apply --block dc,reputation,autoblock,anon
#    and tune + promote the rate rule separately once its threshold is validated

# Providers can also be promoted one at a time, which is usually what the
# evidence supports — a set that blocks nothing does not earn a Block:
python3 provision_waf.py --env dev --apply --block dc:ace
```

Both scripts guard on account (dev/test → 623829546818, prod → 628373393242)
and refuse to run against the wrong one.
