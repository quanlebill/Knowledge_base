import json

_POLICY_FMT_TO_TYPE: dict[str, str] = {
    "Natural Language": "natural_language",
    "Exact Match For Word or Phrase": "exact_word",
}
_POLICY_TYPE_TO_FMT: dict[str, str] = {v: k for k, v in _POLICY_FMT_TO_TYPE.items()}


def policy_fmt_to_type(fmt: str) -> str:
    return _POLICY_FMT_TO_TYPE.get(fmt, "natural_language")


def policy_type_to_fmt(t: str) -> str:
    return _POLICY_TYPE_TO_FMT.get(t, "Natural Language")


def policy_rules_to_str(fmt: str, rules: list) -> str:
    if policy_fmt_to_type(fmt) == "exact_word":
        return json.dumps(rules)
    return " ".join(str(r) for r in rules) if rules else ""


def policy_rules_to_list(policy_type: str, content: str) -> list:
    if policy_type == "exact_word":
        try:
            return json.loads(content)
        except Exception:
            return [content]
    return [content]
