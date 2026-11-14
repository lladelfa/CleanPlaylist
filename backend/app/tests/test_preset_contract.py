import json
from pathlib import Path

from app.main import get_presets

# tests/ -> app/ -> backend/ -> repository root
CONTRACT_PATH = Path(__file__).resolve().parents[3] / "contracts" / "preset-contract.json"


def _load_contract():
    with CONTRACT_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


def test_served_presets_match_contract_ids_categories_flags_and_descriptions():
    contract = _load_contract()
    served = {p["id"]: p for p in get_presets()["presets"]}
    expected = {p["id"]: p for p in contract["presets"]}

    assert set(served) == set(expected)

    for preset_id, exp in expected.items():
        got = served[preset_id]
        assert sorted(got["categories"]) == sorted(exp["categories"]), preset_id
        assert got["include_metadata_explicit"] == exp["include_metadata_explicit"], preset_id
        assert got["description"] == exp["description"], preset_id


CUSTOM_DESCRIPTION = (
    "Applies the fixed slur and strong-profanity rules plus your custom blocklist terms. "
    "Your blocklist applies under every preset."
)
OLD_WORDING = (
    "custom blocklist terms only",
    "User-defined keyword blocklist with customizable preset rules.",
)


def test_custom_description_states_fixed_rules_and_blocklist_under_every_preset():
    from app.config import PRESET_PROFILES

    assert PRESET_PROFILES["custom"]["description"] == CUSTOM_DESCRIPTION
    served = {p["id"]: p for p in get_presets()["presets"]}
    assert served["custom"]["description"] == CUSTOM_DESCRIPTION


def test_contract_custom_description_matches_backend_copy():
    contract = _load_contract()
    custom = next(p for p in contract["presets"] if p["id"] == "custom")
    assert custom["description"] == CUSTOM_DESCRIPTION


CUSTOM_LABEL = "Slurs + Strong Language"


def test_custom_preset_label_renamed_but_id_unchanged():
    from app.config import PRESET_PROFILES

    assert PRESET_PROFILES["custom"]["id"] == "custom"
    assert PRESET_PROFILES["custom"]["name"] == CUSTOM_LABEL
    served = {p["id"]: p for p in get_presets()["presets"]}
    assert served["custom"]["name"] == CUSTOM_LABEL


def test_contract_custom_name_matches_backend_label():
    custom = next(p for p in _load_contract()["presets"] if p["id"] == "custom")
    assert custom["name"] == CUSTOM_LABEL


def test_old_custom_wording_absent_from_every_preset_description():
    from app.config import PRESET_PROFILES

    descriptions = [p["description"] for p in PRESET_PROFILES.values()]
    descriptions += [p["description"] for p in get_presets()["presets"]]
    descriptions += [p["description"] for p in _load_contract()["presets"]]
    for text in descriptions:
        for old in OLD_WORDING:
            assert old.lower() not in text.lower(), text
