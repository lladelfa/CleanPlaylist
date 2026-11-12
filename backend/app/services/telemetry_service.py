"""Telemetry service for CleanPlaylist.

Implements privacy-safe, zero-PII usage event logging conforming to the AD-9 schema.
Validates events using strict Pydantic v2 discriminated union models with extra="forbid",
guards against PII/URL/IP leakage, outputs structured JSON lines to stdout, and optionally
forwards events asynchronously when TELEMETRY_INGEST_URL is configured.
"""

import os
import re
import json
import logging
from datetime import datetime, timezone
from typing import Annotated, Any, Dict, Literal, Union, Optional
from concurrent.futures import ThreadPoolExecutor

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, field_validator, model_validator
import requests

logger = logging.getLogger(__name__)

# PII and Injection Guard Patterns
UUID_REGEX = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)
URL_REGEX = re.compile(r"(?:https?:)?//|spotify:|mailto:", re.IGNORECASE)
EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
IPV4_REGEX = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
IPV6_REGEX = re.compile(r"\b(?:[0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}\b|::1\b|\b[0-9a-fA-F]{1,4}::")


class TelemetryBaseEvent(BaseModel):
    """Base telemetry model containing shared fields across all events."""

    model_config = ConfigDict(extra="forbid")

    platform: Literal["spotify", "ytmusic"]
    viewport_class: Literal["mobile", "desktop"]
    vip_mode: bool
    session_anon_id: str

    @field_validator("session_anon_id")
    @classmethod
    def validate_session_anon_id(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("session_anon_id must be a string")
        v_clean = v.strip()
        if (
            URL_REGEX.search(v_clean)
            or EMAIL_REGEX.search(v_clean)
            or IPV4_REGEX.search(v_clean)
            or IPV6_REGEX.search(v_clean)
        ):
            raise ValueError("Prohibited content (URL, email, or IP address) detected in session_anon_id")
        if not UUID_REGEX.match(v_clean):
            raise ValueError("session_anon_id must be a valid UUID format")
        return v_clean.lower()

    @model_validator(mode="after")
    def check_pii_across_fields(self) -> "TelemetryBaseEvent":
        for field_name, value in self.model_dump().items():
            if isinstance(value, str):
                if (
                    URL_REGEX.search(value)
                    or EMAIL_REGEX.search(value)
                    or IPV4_REGEX.search(value)
                    or IPV6_REGEX.search(value)
                ):
                    raise ValueError(f"Prohibited content detected in field '{field_name}'")
        return self


class InputLoadedEvent(TelemetryBaseEvent):
    """Emitted when tracks are loaded into CleanPlaylist from any source."""

    event: Literal["input_loaded"] = "input_loaded"
    input_type: Literal[
        "song_search",
        "album_search",
        "pasted_list",
        "ytm_playlist",
        "vip_spotify_playlist",
        "working_list_import",
    ]
    track_count_bucket: Literal["1-10", "11-25", "26-50", "51+"]


class ScanCompletedEvent(TelemetryBaseEvent):
    """Emitted when screening/scanning is completed on a set of tracks."""

    event: Literal["scan_completed"] = "scan_completed"
    preset_id: Literal["kid_safe", "moderate", "slurs_only", "custom"]
    track_count: int = Field(ge=0)
    flagged_count: int = Field(ge=0)
    lyrics_unavailable_count: int = Field(ge=0)


class CleanSwapAppliedEvent(TelemetryBaseEvent):
    """Emitted when clean replacements are applied (single or bulk)."""

    event: Literal["clean_swap_applied"] = "clean_swap_applied"
    mode: Literal["single", "bulk"]
    swapped_count: int = Field(ge=0)
    unfound_count: int = Field(ge=0)


class StitchCompletedEvent(TelemetryBaseEvent):
    """Emitted when a multi-playlist stitch operation completes."""

    event: Literal["stitch_completed"] = "stitch_completed"
    source_count: int = Field(ge=0)
    clean_rule: Literal[
        "replace_clean_or_drop",
        "replace_clean_or_keep",
        "exclude_flagged",
        "keep_all",
    ]
    output_count: int = Field(ge=0)


class FinishActionClickedEvent(TelemetryBaseEvent):
    """Emitted when any finish-line export or playback action is clicked."""

    event: Literal["finish_action_clicked"] = "finish_action_clicked"
    action: Literal[
        "play_clean_queue",
        "copy_clean_links",
        "open_track_link",
        "file_export",
        "vip_spotify_save",
    ]


TelemetryEvent = Annotated[
    Union[
        InputLoadedEvent,
        ScanCompletedEvent,
        CleanSwapAppliedEvent,
        StitchCompletedEvent,
        FinishActionClickedEvent,
    ],
    Field(discriminator="event"),
]


class TelemetryService:
    """Service responsible for logging telemetry events and optional async forwarding."""

    def __init__(self):
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="telemetry_forwarder")

    def record_event(self, event: Union[TelemetryBaseEvent, Dict[str, Any]]) -> Dict[str, Any]:
        """Record an event, format structured JSON stdout log, and forward if configured.

        Returns the log payload envelope.
        """
        if isinstance(event, BaseModel):
            event_data = event.model_dump()
        elif isinstance(event, dict):
            validated = TypeAdapter(TelemetryEvent).validate_python(event)
            event_data = validated.model_dump()
        else:
            raise ValueError("Event must be a TelemetryBaseEvent or dict")

        timestamp = datetime.now(timezone.utc).isoformat()
        log_payload = {
            "channel": "cp_telemetry",
            "schema_version": 1,
            "timestamp": timestamp,
            "data": event_data,
        }

        # Stdout structured log line prefixed with [cp_telemetry]
        print(f"[cp_telemetry] {json.dumps(log_payload)}", flush=True)

        # Optional forwarding via TELEMETRY_INGEST_URL
        ingest_url = os.getenv("TELEMETRY_INGEST_URL")
        if ingest_url:
            self._forward_async(ingest_url, log_payload)

        return log_payload

    def _forward_async(self, url: str, payload: Dict[str, Any]):
        """Forward payload asynchronously with a short timeout without blocking."""
        def _send():
            try:
                requests.post(url, json=payload, timeout=2.0)
            except Exception as e:
                logger.debug(f"Telemetry ingest forward failed: {e}")

        try:
            self._executor.submit(_send)
        except Exception as e:
            logger.debug(f"Failed to submit telemetry forward task: {e}")


telemetry_service = TelemetryService()
