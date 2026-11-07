import pytest
from app.main import app, get_presets
from app.config import PRESET_PROFILES, WORD_CATEGORIES


def test_presets_route_registered():
    paths = {getattr(r, "path", None): getattr(r, "methods", set()) for r in app.routes}
    assert "/api/presets" in paths
    assert "GET" in paths["/api/presets"]


def test_get_presets_schema_and_canonical_data():
    data = get_presets()

    assert "presets" in data
    assert "categories" in data
    assert "morphological_suffix_pattern" in data

    assert data["morphological_suffix_pattern"] == "(?:ing|ed|s|es)?"

    preset_ids = {p["id"] for p in data["presets"]}
    assert preset_ids == {"kid_safe", "moderate", "slurs_only", "custom"}

    for p in data["presets"]:
        assert "id" in p
        assert "name" in p
        assert "description" in p
        assert "include_metadata_explicit" in p
        assert "categories" in p
        assert isinstance(p["categories"], list)

    expected_categories = {"slurs", "strong_profanity", "mild_profanity", "sexual", "substances"}
    assert set(data["categories"].keys()) == expected_categories

    for cat, words in data["categories"].items():
        assert isinstance(words, list)
        assert words == sorted(words)
        assert len(words) > 0
