#!/usr/bin/env python3
"""Lambda entry point for the scheduled edge-autoblock producer.

Wraps autoblock_detector.py rather than reimplementing it, so the judgement has
one home whether it runs from a laptop or on a schedule.

Enforcement is off unless ENFORCE is set. A blocker that starts banning on its
first run has never been watched doing it; the history table accumulates either
way, so the shadow period is what tells you whether the thresholds are right.
"""
import os

import autoblock_detector as detector


def handler(event, context):
    env = os.environ["ENV_NAME"]
    app = os.environ.get("APP_NAME", "reserve-rec")
    enforce = os.environ.get("ENFORCE", "false").lower() == "true"
    hours = int(os.environ.get("WINDOW_HOURS", "24"))

    # An empty run is the normal state, not a failure: it means nobody crossed
    # the threshold this hour.
    return detector.detect(env, app, apply_changes=True, enforce=enforce, hours=hours)
