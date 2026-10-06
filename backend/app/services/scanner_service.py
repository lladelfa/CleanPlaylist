"""Offensive language and custom keyword scanner for song lyrics."""

import re
from typing import Dict, List, Optional, Set, Tuple
from better_profanity import profanity
from app.config import PRESET_PROFILES, WORD_CATEGORIES

# Initialize default profanity filter
profanity.load_censor_words()


class ScannerService:
    def __init__(self):
        self.categories = WORD_CATEGORIES
        self.presets = PRESET_PROFILES

    def _compile_patterns(self, words: Set[str]) -> List[re.Pattern]:
        """Compile a list of words or phrases into boundary-aware regex patterns."""
        patterns = []
        for word in words:
            cleaned = word.strip().lower()
            if not cleaned:
                continue
            # Escape regex specials, but allow whole-word boundary
            escaped = re.escape(cleaned)
            # If word contains letters only, match with word boundary
            pattern = re.compile(rf"\b{escaped}(?:ing|ed|s|es)?\b", re.IGNORECASE)
            patterns.append((cleaned, pattern))
        return patterns

    def scan_lyrics(
        self,
        lyrics: str,
        preset: str = "moderate",
        custom_blocklist: Optional[List[str]] = None,
        is_metadata_explicit: bool = False
    ) -> Dict:
        """
        Scans lyrics text for offensive language according to the chosen preset
        and optional custom blocklist.
        """
        config = self.presets.get(preset, self.presets["moderate"])
        active_categories = config.get("categories", ["slurs", "strong_profanity"])
        include_metadata = config.get("include_metadata_explicit", True)

        detected_terms: Dict[str, Dict] = {}
        snippets: List[Dict] = []
        reasons: List[str] = []

        # 1. Metadata Check
        if include_metadata and is_metadata_explicit:
            reasons.append("Marked Explicit by YouTube Music")

        if not lyrics or not lyrics.strip():
            return {
                "is_flagged": len(reasons) > 0,
                "reasons": reasons,
                "detected_terms": [],
                "total_flagged_count": 0,
                "snippets": [],
                "has_lyrics": False,
            }

        lines = lyrics.splitlines()

        # Build list of active word patterns grouped by category
        category_patterns: List[Tuple[str, str, re.Pattern]] = []
        for cat in active_categories:
            words = self.categories.get(cat, set())
            for word in words:
                pattern = re.compile(rf"\b{re.escape(word)}(?:ing|ed|s|es)?\b", re.IGNORECASE)
                category_patterns.append((cat, word, pattern))

        # Add custom blocklist patterns
        custom_patterns: List[Tuple[str, str, re.Pattern]] = []
        if custom_blocklist:
            for word in custom_blocklist:
                cleaned = word.strip().lower()
                if cleaned:
                    pattern = re.compile(rf"\b{re.escape(cleaned)}\b", re.IGNORECASE)
                    custom_patterns.append(("custom", cleaned, pattern))

        # Scan line by line
        for line_idx, line in enumerate(lines, start=1):
            line_str = line.strip()
            if not line_str:
                continue

            line_matches = []

            # Check category patterns
            for cat, root_word, pattern in category_patterns:
                for match in pattern.finditer(line_str):
                    matched_text = match.group(0).lower()
                    line_matches.append((cat, matched_text))
                    
                    if matched_text not in detected_terms:
                        detected_terms[matched_text] = {
                            "word": matched_text,
                            "category": cat,
                            "count": 0,
                            "occurrences": []
                        }
                    detected_terms[matched_text]["count"] += 1
                    detected_terms[matched_text]["occurrences"].append(line_idx)

            # Check custom blocklist patterns
            for cat, root_word, pattern in custom_patterns:
                for match in pattern.finditer(line_str):
                    matched_text = match.group(0).lower()
                    line_matches.append((cat, matched_text))

                    if matched_text not in detected_terms:
                        detected_terms[matched_text] = {
                            "word": matched_text,
                            "category": "custom",
                            "count": 0,
                            "occurrences": []
                        }
                    detected_terms[matched_text]["count"] += 1
                    detected_terms[matched_text]["occurrences"].append(line_idx)

            if line_matches:
                snippets.append({
                    "line_number": line_idx,
                    "text": line_str,
                    "matched_terms": [m[1] for m in line_matches]
                })

        # Summarize reasons
        if detected_terms:
            cat_counts: Dict[str, int] = {}
            for item in detected_terms.values():
                cat = item["category"]
                cat_counts[cat] = cat_counts.get(cat, 0) + item["count"]

            for cat, count in cat_counts.items():
                label = cat.replace("_", " ").title()
                reasons.append(f"Found {count} {label} instance(s)")

        total_flags = sum(item["count"] for item in detected_terms.values())
        is_flagged = bool(reasons) or (include_metadata and is_metadata_explicit)

        return {
            "is_flagged": is_flagged,
            "reasons": reasons,
            "detected_terms": list(detected_terms.values()),
            "total_flagged_count": total_flags,
            "snippets": snippets[:20],  # Return up to 20 representative snippets
            "has_lyrics": True,
        }

    def search_specific_keywords(
        self,
        lyrics: str,
        target_keywords: List[str]
    ) -> Dict:
        """
        Searches lyrics for a specific set of user-provided keywords.
        Returns detailed occurrences and line snippets.
        """
        if not lyrics or not target_keywords:
            return {
                "matched": False,
                "total_matches": 0,
                "keywords_found": [],
                "snippets": []
            }

        lines = lyrics.splitlines()
        keyword_stats: Dict[str, Dict] = {}
        snippets: List[Dict] = []

        patterns: List[Tuple[str, re.Pattern]] = []
        for kw in target_keywords:
            cleaned = kw.strip().lower()
            if cleaned:
                pattern = re.compile(rf"\b{re.escape(cleaned)}\b", re.IGNORECASE)
                patterns.append((cleaned, pattern))
                keyword_stats[cleaned] = {
                    "keyword": cleaned,
                    "count": 0,
                    "lines": []
                }

        for line_idx, line in enumerate(lines, start=1):
            line_str = line.strip()
            if not line_str:
                continue

            line_hits = []
            for kw, pattern in patterns:
                matches = pattern.findall(line_str)
                if matches:
                    keyword_stats[kw]["count"] += len(matches)
                    keyword_stats[kw]["lines"].append(line_idx)
                    line_hits.append(kw)

            if line_hits:
                snippets.append({
                    "line_number": line_idx,
                    "text": line_str,
                    "matched_keywords": line_hits
                })

        found_list = [v for v in keyword_stats.values() if v["count"] > 0]
        total_matches = sum(v["count"] for v in found_list)

        return {
            "matched": total_matches > 0,
            "total_matches": total_matches,
            "keywords_found": found_list,
            "snippets": snippets
        }


scanner_service = ScannerService()
