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
