"""Configuration and filtering profile presets for CleanPlaylist."""

from typing import Dict, List, Set

PRESET_PROFILES: Dict[str, Dict] = {
    "kid_safe": {
        "id": "kid_safe",
        "name": "Kid-Safe / Strict",
        "description": "Filters all profanity, vulgar language, crude humor, substance references, and slurs.",
        "include_metadata_explicit": True,
        "categories": ["slurs", "strong_profanity", "mild_profanity", "sexual", "substances"],
    },
    "moderate": {
        "id": "moderate",
        "name": "Moderate (Recommended)",
        "description": "Filters standard explicit language, F-bombs, vulgar sexual references, and slurs (allows mild words like damn/hell).",
        "include_metadata_explicit": True,
        "categories": ["slurs", "strong_profanity", "sexual"],
    },
    "slurs_only": {
        "id": "slurs_only",
        "name": "Slurs & Hate Speech Only",
        "description": "Flags only discriminatory slurs and severely offensive derogatory terms.",
        "include_metadata_explicit": False,
        "categories": ["slurs"],
    },
    "custom": {
        "id": "custom",
        "name": "Custom Filter",
        "description": "User-defined keyword blocklist with customizable preset rules.",
        "include_metadata_explicit": True,
        "categories": ["slurs", "strong_profanity"],
    }
}

# Lexicon categorized for clear feedback in the UI
WORD_CATEGORIES: Dict[str, Set[str]] = {
    "slurs": {
        "nigger", "nigga", "faggot", "fag", "dyke", "kike", "spic", "chink", "wetback",
        "tranny", "retard", "cunt", "coon", "gook", "towelhead"
    },
    "strong_profanity": {
        "fuck", "fucking", "fucked", "fucker", "motherfucker", "motherfucking", "shit",
        "shitty", "bullshit", "bitch", "bitches", "bitching", "asshole", "bastard",
        "dick", "cock", "pussy", "twat", "whore", "slut"
    },
    "mild_profanity": {
        "damn", "dammit", "hell", "crap", "piss", "pissed", "ass", "badass"
    },
    "sexual": {
        "blowjob", "handjob", "cum", "ejaculat", "orgasm", "dildo", "masturbat",
        "horny", "boner", "tits", "boobs", "clit", "vagina", "penis"
    },
    "substances": {
        "cocaine", "coke", "heroin", "meth", "weed", "blunt", "joint", "percocet",
        "lean", "codeine", "xanax", "molly", "ecstasy"
    }
}
