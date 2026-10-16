"""Tests for provision_waf rule building. Run: python3 -m unittest test_provision_waf"""
import json
import unittest

import provision_waf as pw

IPSETS = {n: f"arn:{n}" for n in ("edge-reputation", "edge-reputation-v6",
                                  "edge-autoblock", "edge-autoblock-v6")}
LOWER = [{"Priority": 0, "Type": "LOWERCASE"}]
DECODE_LOWER = [{"Priority": 0, "Type": "URL_DECODE"}, {"Priority": 1, "Type": "LOWERCASE"}]
EMPTY = {"workerSuffixes": [], "uaBlock": [], "retiredPaths": [], "uaExempt": []}


def edge(**lists):
    return {**EMPTY, **lists}


def by_name(rules):
    return {r["Name"]: r for r in rules}


def bm(search, field, constraint, transforms):
    return {"ByteMatchStatement": {"SearchString": search, "FieldToMatch": field,
                                   "TextTransformations": transforms,
                                   "PositionalConstraint": constraint}}


UA = {"SingleHeader": {"Name": "user-agent"}}
PATH = {"UriPath": {}}


class EdgeMatchRules(unittest.TestCase):
    def test_empty_lists_add_no_rules(self):
        for em in (None, EMPTY, edge(uaExempt=["monitor"])):
            names = [r["Name"] for r in pw.build_rules(IPSETS, set(), [], edge_match=em)]
            self.assertEqual(names, ["capture-ja", "edge-reputation", "edge-autoblock",
                                     "AnonymousIpList", "require-auth-availability",
                                     "rate-dayuse-api"])

    def test_worker_header_single_suffix(self):
        rule = by_name(pw.build_rules(IPSETS, set(), [],
                                      edge_match=edge(workerSuffixes=[".x.test"])))["edge-worker-header"]
        self.assertEqual(rule["Priority"], 57)
        self.assertEqual(rule["Action"], {"Count": {}})
        self.assertEqual(rule["Statement"],
                         bm(b".x.test", {"SingleHeader": {"Name": "cf-worker"}}, "ENDS_WITH", LOWER))

    def test_ua_availability_with_exemption(self):
        rule = by_name(pw.build_rules(IPSETS, set(), [], edge_match=edge(
            uaBlock=["agent-a", "agent-b"], uaExempt=["monitor"])))["edge-ua-availability"]
        self.assertEqual(rule["Priority"], 58)
        self.assertEqual(rule["Statement"], {"AndStatement": {"Statements": [
            {"OrStatement": {"Statements": [bm(b"agent-a", UA, "CONTAINS", LOWER),
                                            bm(b"agent-b", UA, "CONTAINS", LOWER)]}},
            {"OrStatement": {"Statements": [
                bm(b"/dayuse/api/inventorypools/", PATH, "STARTS_WITH", DECODE_LOWER),
                bm(b"/dayuse/api/product-dates/", PATH, "STARTS_WITH", DECODE_LOWER),
                bm(b"/dayuse/api/products/", PATH, "STARTS_WITH", DECODE_LOWER)]}},
            {"NotStatement": {"Statement": bm(b"monitor", UA, "CONTAINS", LOWER)}},
        ]}})

    def test_retired_paths_exempt_wraps_single_match(self):
        rule = by_name(pw.build_rules(IPSETS, set(), [], edge_match=edge(
            retiredPaths=["/old/"], uaExempt=["m1", "m2"])))["edge-retired-paths"]
        self.assertEqual(rule["Priority"], 59)
        self.assertEqual(rule["Statement"], {"AndStatement": {"Statements": [
            bm(b"/old/", PATH, "STARTS_WITH", LOWER),
            {"NotStatement": {"Statement": {"OrStatement": {"Statements": [
                bm(b"m1", UA, "CONTAINS", LOWER), bm(b"m2", UA, "CONTAINS", LOWER)]}}}},
        ]}})

    def test_edge_group_controls_block(self):
        em = edge(workerSuffixes=["w"], uaBlock=["u"], retiredPaths=["/r/"])
        for block, want in ((set(), {"Count": {}}), ({"ja4"}, {"Count": {}}),
                            ({"edge"}, {"Block": {}})):
            rules = by_name(pw.build_rules(IPSETS, block, [], edge_match=em))
            for name in ("edge-worker-header", "edge-ua-availability", "edge-retired-paths"):
                self.assertEqual(rules[name]["Action"], want, (block, name))

    def test_priorities_unique_with_every_rule_present(self):
        rules = pw.build_rules(IPSETS, set(), [], ja4=["fp"], edge_match=edge(
            workerSuffixes=["w"], uaBlock=["u"], retiredPaths=["/r/"]))
        self.assertEqual([r["Priority"] for r in rules], [0, 50, 51, 52, 55, 56, 57, 58, 59, 60])

    def test_require_auth_statement(self):
        rule = by_name(pw.build_rules(IPSETS, set(), []))["require-auth-availability"]
        self.assertEqual(rule["Statement"]["AndStatement"]["Statements"][0],
                         {"OrStatement": {"Statements": [
                             bm(b"/dayuse/api/inventorypools/", PATH, "STARTS_WITH", DECODE_LOWER),
                             bm(b"/dayuse/api/product-dates/", PATH, "STARTS_WITH", DECODE_LOWER)]}})


class FakeSSM:
    class exceptions:
        class ParameterNotFound(Exception):
            pass

    def __init__(self, params):
        self.params = params

    def get_parameter(self, Name):
        if Name not in self.params:
            raise self.exceptions.ParameterNotFound(Name)
        return {"Parameter": {"Value": self.params[Name]}}


class FakeSession:
    def __init__(self, params):
        self.ssm = FakeSSM(params)

    def client(self, service, region_name):
        return self.ssm


class LoadEdgeMatch(unittest.TestCase):
    def test_missing_parameter_is_empty(self):
        self.assertEqual(pw.load_edge_match("dev", FakeSession({})), EMPTY)

    def test_values_lowercased_and_blanks_dropped(self):
        value = json.dumps({"workerSuffixes": [".X.Test"], "uaBlock": ["Agent-A", ""],
                            "uaExempt": None})
        got = pw.load_edge_match("test", FakeSession(
            {"/reserveRecPublic/test/frontDoorWaf/edgeMatch": value}))
        self.assertEqual(got, edge(workerSuffixes=[".x.test"], uaBlock=["agent-a"]))

    def test_ja4_loader_still_reads_its_parameter(self):
        session = FakeSession({"/reserveRecPublic/dev/frontDoorWaf/ja4": '{"ja4": ["fp1"]}'})
        self.assertEqual(pw.load_ja4("dev", session), ["fp1"])
        self.assertEqual(pw.load_ja4("prod", session), [])


if __name__ == "__main__":
    unittest.main()
