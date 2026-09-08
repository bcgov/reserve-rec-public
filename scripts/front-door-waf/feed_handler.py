#!/usr/bin/env python3
"""Lambda entry point for the scheduled datacenter IPSet refresh.

Wraps datacenter_feed.py rather than reimplementing it, so the fetch and merge
logic has one home whether it runs from a laptop or on a schedule.

The function is deployed in ca-central-1 while the IPSets it writes are
CLOUDFRONT scope in us-east-1. That is a client region for the API call, not a
deployment target — CloudFormation is denied in us-east-1 by the LZA SCP, which
is why provision_waf.py is a script but this can be CDK.

WHICH providers get refreshed is read from SSM at run time and is deliberately
not in this repository.
"""
import os

import datacenter_feed as feed
from provision_waf import load_providers


def handler(event, context):
    env = os.environ["ENV_NAME"]

    fetchers = feed.build_fetchers(load_providers(env))
    data = feed.collect(fetchers)
    feed.apply(env, data)

    refreshed = sorted(n for n, d in data.items() if d)
    failed = sorted(n for n, d in data.items() if not d)

    # A provider that fails to fetch leaves its IPSet untouched, so a partial
    # failure is survivable and worth reporting rather than retrying blindly.
    # Everything failing is a different problem — usually egress or credentials.
    if failed and not refreshed:
        raise RuntimeError(f"every provider failed to fetch for {env}")

    return {"env": env, "refreshed": len(refreshed), "failed": failed}
