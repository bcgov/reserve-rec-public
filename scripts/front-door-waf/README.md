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

## Ruleset (ported from DUP's `dup-edge-ja`)

| Pri | Rule | Default action |
|---|---|---|
| 0 | `capture-ja` — JA4 fingerprint capture on `/dayuse/api/` | Count (telemetry, never blocks) |
| 10–19 | `dc-<provider>` — 10 datacenter/VPS blocks | Count → Block |
| 20 | `edge-reputation` | Count → Block |
| 21 | `edge-autoblock` (watchlist) | Count → Block |
| 22 | `AnonymousIpList` (AWS managed) | Count → Block |
| 30 | `rate-dayuse-api` — per-IP rate limit | Count → Block (tune threshold first) |

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

# 5. after watching WAF logs/metrics for false positives, promote to Block:
python3 provision_waf.py --env dev --apply --block dc,reputation,autoblock,anon
#    and tune + promote the rate rule separately once its threshold is validated
```

Both scripts guard on account (dev/test → 623829546818, prod → 628373393242)
and refuse to run against the wrong one.
