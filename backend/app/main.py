"""Main FastAPI application for CleanPlaylist."""

import os
import re
import logging
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)
from fastapi import FastAPI, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ConfigDict
from dotenv import load_dotenv

from app.config import PRESET_PROFILES, WORD_CATEGORIES
from app.services.scanner_service import scanner_service
from app.services.lyric_xref_service import lyric_xref_service
from app.services.stitcher_service import stitcher_service
from app.services.ytmusic_service import ytmusic_service
from app.services.spotify_service import spotify_service

load_dotenv()

app = FastAPI(
    title="CleanPlaylist API",
    description="Intelligent offensive language detection and playlist stitching for YouTube Music & Spotify",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TrackScanItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    setVideoId: Optional[str] = None
    index: Optional[int] = None
    title: str
    artist: str
    artists_list: List[str] = Field(default_factory=list)
    album: Optional[str] = ""
    duration: Optional[str] = ""
    duration_seconds: Optional[int] = 0
    is_explicit: Optional[bool] = False
    thumbnail: Optional[str] = None
    video_url: Optional[str] = None
    verification_status: Optional[str] = "unscanned"
    source_platform: Optional[str] = None
    ytmusic_video_id: Optional[str] = None
    confidence_score: Optional[int] = None

class AlbumSummary(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    artist: str
    thumbnail: Optional[str] = None
    track_count: Optional[int] = None
    year: Optional[str] = None
    source_platform: Optional[str] = None

class CatalogSearchRequest(BaseModel):
    query: str
    platform: Optional[str] = "ytmusic"
    limit: Optional[int] = 10

class CatalogSearchResponse(BaseModel):
    songs: List[TrackScanItem]
    albums: List[AlbumSummary]

class CatalogAlbumRequest(BaseModel):
    album_id: str
    platform: Optional[str] = "ytmusic"

class CatalogAlbumResponse(BaseModel):
    id: str
    title: str
    artist: str
    thumbnail: Optional[str] = None
    track_count: int
    tracks: List[TrackScanItem]

class CatalogResolveRequest(BaseModel):
    lines: List[str] = Field(default_factory=list, max_length=50)
    platform: Optional[str] = "ytmusic"

class UnresolvedLineItem(BaseModel):
    line: str
    reason: str
    target_platform: Optional[str] = None

class CatalogResolveResponse(BaseModel):
    resolved: List[TrackScanItem]
    unresolved: List[UnresolvedLineItem]

class PlaylistFetchRequest(BaseModel):
    url_or_id: str
    limit: Optional[int] = 50
    platform: Optional[str] = "ytmusic"

class ScannedTrackItem(TrackScanItem):
    is_flagged: bool = False
    reasons: List[str] = Field(default_factory=list)
    snippets: List[Dict[str, Any]] = Field(default_factory=list)
    detected_terms: List[Dict[str, Any]] = Field(default_factory=list)
    total_flagged_count: int = 0
    has_lyrics: bool = False

class PlaylistScanSummary(BaseModel):
    model_config = ConfigDict(extra="ignore")
    total_tracks: int
    flagged_tracks: int
    clean_tracks: int
    deep_scanned_tracks: Optional[int] = 0

class PlaylistScanResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    tracks: List[ScannedTrackItem]
    summary: PlaylistScanSummary
    lyrics_by_id: Dict[str, str] = Field(default_factory=dict)

class PlaylistScanRequest(BaseModel):
    tracks: List[TrackScanItem]
    preset: Optional[str] = "moderate"
    custom_blocklist: Optional[List[str]] = Field(default_factory=list)
    deep_scan_lyrics: Optional[bool] = True
    max_deep_scan: Optional[int] = 20
    platform: Optional[str] = "ytmusic" 

class SingleTrackScanRequest(BaseModel):
    video_id: str
    title: Optional[str] = None
    artist: Optional[str] = None
    duration: Optional[str] = None
    duration_seconds: Optional[int] = 0
    ytmusic_video_id: Optional[str] = None
    preset: Optional[str] = "moderate"
    custom_blocklist: Optional[List[str]] = Field(default_factory=list)
    is_explicit: Optional[bool] = False
    platform: Optional[str] = "ytmusic"

class KeywordSearchRequest(BaseModel):
    tracks: List[TrackScanItem]
    target_keywords: List[str]
    max_tracks: Optional[int] = 30
    platform: Optional[str] = "ytmusic"

class FindCleanReplacementRequest(BaseModel):
    title: str
    artist: str
    duration_seconds: Optional[int] = 0
    platform: Optional[str] = "ytmusic"
    track_id: Optional[str] = None
    exclude_track_id: Optional[str] = None

class FindBatchCleanReplacementRequest(BaseModel):
    tracks: List[TrackScanItem]
    platform: Optional[str] = "ytmusic"

class StitchRequest(BaseModel):
    playlists: List[Dict[str, Any]]
    order_mode: Optional[str] = "sequential"
    deduplication_mode: Optional[str] = "exact_id"
    clean_mode: Optional[str] = "keep_all"
    manual_replacements: Optional[Dict[str, Dict[str, Any]]] = Field(default_factory=dict)
    manual_actions: Optional[Dict[str, str]] = Field(default_factory=dict)

class ExportRequest(BaseModel):
    format: str
    tracks: List[Dict[str, Any]]
    playlist_title: Optional[str] = "Clean Playlist"

# Router imports
from app.spotify_endpoints import router as spotify_router
app.include_router(spotify_router)

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/presets")
def get_presets():
    return {
        "presets": list(PRESET_PROFILES.values()),
        "categories": {k: sorted(list(v)) for k, v in WORD_CATEGORIES.items()},
        "morphological_suffix_pattern": "(?:ing|ed|s|es)?",
    }

@app.post("/api/catalog/search", response_model=CatalogSearchResponse)
def search_catalog(req: CatalogSearchRequest):
    query = (req.query or "").strip()
    if not query:
        return {"songs": [], "albums": []}
    limit = min(max(1, req.limit or 10), 10)
    if req.platform == "spotify":
        result = spotify_service.search_catalog(query=query, limit=limit)
    else:
        result = ytmusic_service.search_catalog(query=query, limit=limit)
    return {
        "songs": [TrackScanItem(**s) for s in result.get("songs", [])],
        "albums": [AlbumSummary(**a) for a in result.get("albums", [])],
    }

@app.post("/api/catalog/album", response_model=CatalogAlbumResponse)
def get_catalog_album(req: CatalogAlbumRequest):
    try:
        if req.platform == "spotify":
            result = spotify_service.get_album(album_id=req.album_id)
        else:
            result = ytmusic_service.get_album(album_id=req.album_id)
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "id": result["id"],
        "title": result["title"],
        "artist": result["artist"],
        "thumbnail": result.get("thumbnail"),
        "track_count": result.get("track_count", len(result.get("tracks", []))),
        "tracks": [TrackScanItem(**t) for t in result.get("tracks", [])],
    }

@app.post("/api/catalog/resolve", response_model=CatalogResolveResponse)
def resolve_catalog_lines(req: CatalogResolveRequest):
    if len(req.lines) > 50:
        raise HTTPException(status_code=400, detail="Cannot resolve more than 50 lines at once.")
    platform = req.platform or "ytmusic"
    resolved: List[TrackScanItem] = []
    unresolved: List[UnresolvedLineItem] = []

    for raw_line in req.lines:
        line = (raw_line or "").strip()
        if not line:
            continue

        lower_line = line.lower()
        is_spotify = "spotify.com" in lower_line or lower_line.startswith("spotify:")
        is_ytm = (
            "music.youtube.com" in lower_line
            or "youtube.com" in lower_line
            or "youtu.be" in lower_line
        )

        if platform == "spotify":
            if is_ytm:
                unresolved.append(
                    UnresolvedLineItem(
                        line=line,
                        reason="wrong_platform",
                        target_platform="ytmusic",
                    )
                )
                continue
            is_spotify_track = (
                bool(re.search(r"spotify\.com/(?:intl-[a-zA-Z-]+/)?track/", lower_line))
                or lower_line.startswith("spotify:track:")
            )
            if is_spotify_track:
                try:
                    track_data = spotify_service.resolve_track(line)
                    resolved.append(TrackScanItem(**track_data))
                except Exception:
                    unresolved.append(
                        UnresolvedLineItem(line=line, reason="not_found")
                    )
                continue
            # Text line search fallback
            try:
                search_res = spotify_service.search_catalog(query=line, limit=1)
                songs = search_res.get("songs", [])
                if songs:
                    resolved.append(TrackScanItem(**songs[0]))
                else:
                    unresolved.append(
                        UnresolvedLineItem(line=line, reason="not_found")
                    )
            except Exception:
                unresolved.append(
                    UnresolvedLineItem(line=line, reason="not_found")
                )
        else:
            # platform == "ytmusic"
            if is_spotify:
                unresolved.append(
                    UnresolvedLineItem(
                        line=line,
                        reason="wrong_platform",
                        target_platform="spotify",
                    )
                )
                continue
            if (
                "music.youtube.com/watch" in lower_line
                or "youtube.com/watch" in lower_line
                or "youtu.be/" in lower_line
            ):
                try:
                    track_data = ytmusic_service.resolve_track(line)
                    resolved.append(TrackScanItem(**track_data))
                except Exception:
                    unresolved.append(
                        UnresolvedLineItem(line=line, reason="not_found")
                    )
                continue
            # Text line search fallback
            try:
                search_res = ytmusic_service.search_catalog(query=line, limit=1)
                songs = search_res.get("songs", [])
                if songs:
                    resolved.append(TrackScanItem(**songs[0]))
                else:
                    unresolved.append(
                        UnresolvedLineItem(line=line, reason="not_found")
                    )
            except Exception:
                unresolved.append(
                    UnresolvedLineItem(line=line, reason="not_found")
                )

    return {"resolved": resolved, "unresolved": unresolved}

@app.post("/api/playlist/fetch")
def fetch_playlist(req: PlaylistFetchRequest, request: Request, response: Response):
    try:
        if req.platform == "spotify":
            sp_client = spotify_service.get_client(request=request, response=response)
            return spotify_service.get_playlist(req.url_or_id, sp_client=sp_client, limit=req.limit or 50)
        else:
            return ytmusic_service.get_playlist(req.url_or_id, limit=req.limit or 50)
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/scan/playlist", response_model=PlaylistScanResponse)
def scan_playlist(req: PlaylistScanRequest):
    results = []
    deep_scanned_count = 0
    platform = (req.platform or "ytmusic").strip().lower()
    config = PRESET_PROFILES.get(req.preset or "moderate", PRESET_PROFILES["moderate"])
    include_metadata = config.get("include_metadata_explicit", True)

    # 1. Resolve lyrics and YouTube IDs concurrently via lyric_xref_service
    lyrics_by_id: Dict[str, str] = {}

    def _fetch_lyrics_and_id(track: TrackScanItem):
        try:
            yt_id, lyrics_text = lyric_xref_service.resolve_lyrics_and_yt_id(track, platform)
            return (track.id, yt_id, lyrics_text, None)
        except Exception as e:
            return (track.id, None, None, e)

    fetch_results = {}
    if req.deep_scan_lyrics:
        workers = min(len(req.tracks), 8) or 1
        with ThreadPoolExecutor(max_workers=workers) as executor:
            resolved_list = list(executor.map(_fetch_lyrics_and_id, req.tracks))
        for trk_id, yt_id, lyrics_text, err in resolved_list:
            fetch_results[trk_id] = (yt_id, lyrics_text, err)
    else:
        for t in req.tracks:
            fetch_results[t.id] = (None, None, None)

    for track in req.tracks:
        yt_id, lyrics, err = fetch_results.get(track.id, (None, None, None))

        # Unhandled failure during resolution
        if err is not None:
            track_dict = track.model_dump()
            track_dict.update({
                "is_flagged": False,
                "reasons": [f"Scan error: {str(err)}"],
                "detected_terms": [],
                "total_flagged_count": 0,
                "snippets": [],
                "has_lyrics": False,
                "verification_status": "scan_error",
            })
            if yt_id and not track_dict.get("ytmusic_video_id"):
                track_dict["ytmusic_video_id"] = yt_id
            results.append(ScannedTrackItem(**track_dict))
            continue

        has_lyrics = bool(lyrics and lyrics.strip())
        if has_lyrics:
            lyrics_by_id[track.id] = lyrics
            deep_scanned_count += 1

        scan_result = scanner_service.scan_lyrics(
            lyrics=lyrics or "",
            preset=req.preset or "moderate",
            custom_blocklist=req.custom_blocklist or [],
            is_metadata_explicit=bool(track.is_explicit),
            platform=platform,
        )

        is_explicit = bool(track.is_explicit)
        # Zero False-Clean state machine:
        if not has_lyrics:
            if is_explicit and include_metadata:
                verification_status = "flagged"
            else:
                verification_status = "lyrics_unavailable"
        else:
            if scan_result["is_flagged"] or (is_explicit and include_metadata) or scan_result["total_flagged_count"] > 0:
                verification_status = "flagged"
            else:
                verification_status = "verified_clean"

        track_dict = track.model_dump()
        track_dict.update({
            "is_flagged": scan_result["is_flagged"],
            "reasons": scan_result["reasons"],
            "detected_terms": scan_result["detected_terms"],
            "total_flagged_count": scan_result["total_flagged_count"],
            "snippets": scan_result["snippets"],
            "has_lyrics": has_lyrics,
            "verification_status": verification_status,
        })
        if yt_id and not track_dict.get("ytmusic_video_id"):
            track_dict["ytmusic_video_id"] = yt_id

        results.append(ScannedTrackItem(**track_dict))

    flagged_count = sum(1 for t in results if t.is_flagged)
    clean_count = sum(1 for t in results if t.verification_status == "verified_clean")

    return PlaylistScanResponse(
        tracks=results,
        summary=PlaylistScanSummary(
            total_tracks=len(results),
            flagged_tracks=flagged_count,
            clean_tracks=clean_count,
            deep_scanned_tracks=deep_scanned_count,
        ),
        lyrics_by_id=lyrics_by_id,
    )

@app.post("/api/scan/track-lyrics")
def scan_single_track_lyrics(req: SingleTrackScanRequest):
    platform = (req.platform or "ytmusic").strip().lower()
    if platform == "spotify":
        track_payload = {
            "id": req.video_id,
            "title": req.title or "",
            "artist": req.artist or "",
            "duration": req.duration,
            "duration_seconds": req.duration_seconds or 0,
            "ytmusic_video_id": req.ytmusic_video_id,
        }
        resolved_yt_id, lyrics = lyric_xref_service.resolve_lyrics_and_yt_id(track_payload, "spotify")
    else:
        resolved_yt_id = req.video_id
        service = ytmusic_service
        lyrics = service.get_track_lyrics(req.video_id)
    if not lyrics:
        return {
            "has_lyrics": False,
            "lyrics": None,
            "ytmusic_video_id": resolved_yt_id,
            "scan_result": {
                "is_flagged": req.is_explicit,
                "reasons": ["Marked Explicit by Provider"] if req.is_explicit else [],
                "detected_terms": [],
                "total_flagged_count": 0,
                "snippets": [],
                "has_lyrics": False
            }
        }

    scan_result = scanner_service.scan_lyrics(
        lyrics=lyrics,
        preset=req.preset or "moderate",
        custom_blocklist=req.custom_blocklist or [],
        is_metadata_explicit=req.is_explicit or False
    )

    return {
        "has_lyrics": True,
        "lyrics": lyrics,
        "ytmusic_video_id": resolved_yt_id,
        "scan_result": scan_result
    }

@app.post("/api/scan/keywords")
def search_keywords_in_playlist(req: KeywordSearchRequest):
    if not req.target_keywords:
        raise HTTPException(status_code=400, detail="Target keywords list cannot be empty.")

    clean_keywords = [k.strip().lower() for k in req.target_keywords if k.strip()]
    if not clean_keywords:
        raise HTTPException(status_code=400, detail="No valid keywords provided.")

    per_track_results = []
    tracks_with_matches = 0
    total_occurrences = 0
    lyrics_unavailable_count = 0
    lyrics_by_id: Dict[str, str] = {}
    tracks_to_process = req.tracks[: req.max_tracks or 30]
    platform = (req.platform or "ytmusic").strip().lower()

    def _fetch_lyrics(track: TrackScanItem):
        try:
            yt_id, lyrics_text = lyric_xref_service.resolve_lyrics_and_yt_id(track, platform)
            return (track.id, yt_id, lyrics_text)
        except Exception:
            return (track.id, getattr(track, "ytmusic_video_id", None), None)

    workers = min(len(tracks_to_process), 8) or 1
    with ThreadPoolExecutor(max_workers=workers) as executor:
        resolved_list = list(executor.map(_fetch_lyrics, tracks_to_process))

    lookup_map = {item[0]: (item[1], item[2]) for item in resolved_list}

    for track in tracks_to_process:
        yt_id, lyrics = lookup_map.get(track.id, (getattr(track, "ytmusic_video_id", None), None))
        resolved_yt_id = yt_id or getattr(track, "ytmusic_video_id", None)
        lyrics_by_id[track.id] = lyrics or ""

        if not lyrics:
            lyrics_unavailable_count += 1
            per_track_results.append({
                "id": track.id,
                "title": track.title,
                "artist": track.artist,
                "thumbnail": track.thumbnail,
                "ytmusic_video_id": resolved_yt_id,
                "has_lyrics": False,
                "matched": False,
                "total_matches": 0,
                "keywords_found": [],
                "snippets": []
            })
            continue

        match_data = scanner_service.search_specific_keywords(lyrics, clean_keywords)
        if match_data["matched"]:
            tracks_with_matches += 1
            total_occurrences += match_data["total_matches"]

        per_track_results.append({
            "id": track.id,
            "title": track.title,
            "artist": track.artist,
            "thumbnail": track.thumbnail,
            "ytmusic_video_id": resolved_yt_id,
            "has_lyrics": True,
            "matched": match_data["matched"],
            "total_matches": match_data["total_matches"],
            "keywords_found": match_data["keywords_found"],
            "snippets": match_data["snippets"]
        })

    return {
        "summary": {
            "keywords_searched": clean_keywords,
            "scanned_tracks_count": len(tracks_to_process),
            "tracks_with_matches": tracks_with_matches,
            "total_keyword_occurrences": total_occurrences,
            "lyrics_unavailable_count": lyrics_unavailable_count,
        },
        "results": per_track_results,
        "lyrics_by_id": lyrics_by_id,
    }

@app.post("/api/replacements/find")
def find_clean_replacement(req: FindCleanReplacementRequest, request: Request, response: Response):
    exclude_id = req.exclude_track_id or req.track_id
    platform = (req.platform or "ytmusic").strip().lower()
    lyrics_by_id: Dict[str, str] = {}
    try:
        if platform == "spotify":
            sp_client = spotify_service.get_catalog_client()
            candidate = spotify_service.search_clean_replacement(
                title=req.title,
                artist=req.artist,
                duration_seconds=req.duration_seconds or 0,
                sp_client=sp_client,
                exclude_track_id=exclude_id,
            )
            if candidate:
                yt_id, lyrics = lyric_xref_service.resolve_lyrics_and_yt_id(candidate, platform="spotify")
                if yt_id:
                    candidate["ytmusic_video_id"] = yt_id
                cand_id = candidate.get("id")
                if cand_id and lyrics:
                    lyrics_by_id[cand_id] = lyrics
        else:
            candidate = ytmusic_service.search_clean_replacement(
                title=req.title,
                artist=req.artist,
                duration_seconds=req.duration_seconds or 0,
                exclude_track_id=exclude_id,
            )
            if candidate:
                yt_id, lyrics = lyric_xref_service.resolve_lyrics_and_yt_id(candidate, platform="ytmusic")
                if yt_id and not candidate.get("ytmusic_video_id"):
                    candidate["ytmusic_video_id"] = yt_id
                cand_id = candidate.get("id")
                if cand_id and lyrics:
                    lyrics_by_id[cand_id] = lyrics
    except Exception as e:
        logger.warning(f"Error in find_clean_replacement: {e}")
        candidate = None

    return {
        "found": candidate is not None,
        "clean_candidate": candidate,
        "lyrics_by_id": lyrics_by_id,
    }

@app.post("/api/replacements/find-batch")
def find_batch_clean_replacements(req: FindBatchCleanReplacementRequest, request: Request, response: Response):
    if len(req.tracks) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 tracks allowed per batch request")

    platform = (req.platform or "ytmusic").strip().lower()
    sp_client = None
    if platform == "spotify":
        sp_client = spotify_service.get_catalog_client()

    raw_results: Dict[str, Optional[Dict[str, Any]]] = {}
    lyrics_by_id: Dict[str, str] = {}

    def process_track(track: TrackScanItem) -> Tuple[str, Optional[Dict[str, Any]], Optional[str], Optional[str]]:
        try:
            if platform == "spotify":
                clean_cand = spotify_service.search_clean_replacement(
                    title=track.title,
                    artist=track.artist,
                    duration_seconds=track.duration_seconds or 0,
                    sp_client=sp_client,
                    exclude_track_id=track.id,
                )
                if clean_cand:
                    yt_id, lyrics = lyric_xref_service.resolve_lyrics_and_yt_id(clean_cand, platform="spotify")
                    if yt_id:
                        clean_cand["ytmusic_video_id"] = yt_id
                    return track.id, clean_cand, clean_cand.get("id"), lyrics
                return track.id, None, None, None
            else:
                clean_cand = ytmusic_service.search_clean_replacement(
                    title=track.title,
                    artist=track.artist,
                    duration_seconds=track.duration_seconds or 0,
                    exclude_track_id=track.id,
                )
                if clean_cand:
                    yt_id, lyrics = lyric_xref_service.resolve_lyrics_and_yt_id(clean_cand, platform="ytmusic")
                    return track.id, clean_cand, clean_cand.get("id"), lyrics
                return track.id, None, None, None
        except Exception as e:
            logger.warning(f"Error processing clean replacement for {track.id}: {e}")
            return track.id, None, None, None

    with ThreadPoolExecutor(max_workers=4) as executor:
        future_to_track = {executor.submit(process_track, t): t for t in req.tracks}
        for future in concurrent.futures.as_completed(future_to_track):
            track_id, cand, cand_id, lyrics = future.result()
            raw_results[track_id] = cand
            if cand_id and lyrics:
                lyrics_by_id[cand_id] = lyrics

    # Preserve deterministic ordering of requested tracks
    results = {t.id: raw_results.get(t.id) for t in req.tracks}

    return {
        "results": results,
        "lyrics_by_id": lyrics_by_id,
    }

@app.post("/api/stitch")
def stitch_playlists_endpoint(req: StitchRequest):
    result = stitcher_service.stitch_playlists(
        playlists=req.playlists,
        order_mode=req.order_mode or "sequential",
        deduplication_mode=req.deduplication_mode or "exact_id",
        clean_mode=req.clean_mode or "keep_all",
        manual_replacements=req.manual_replacements or {},
        manual_actions=req.manual_actions or {}
    )
    return result

@app.post("/api/export")
def export_playlist_file(req: ExportRequest):
    fmt = req.format.lower()
    title = req.playlist_title or "CleanPlaylist"
    safe_filename = "".join(c for c in title if c.isalnum() or c in (" ", "_", "-")).rstrip()

    if fmt in ("m3u", "m3u8"):
        content = stitcher_service.export_as_m3u(req.tracks, title)
        return Response(content=content, media_type="audio/x-mpegurl", headers={"Content-Disposition": f'attachment; filename="{safe_filename}.m3u8"'})
    elif fmt == "csv":
        content = stitcher_service.export_as_csv(req.tracks)
        return Response(content=content, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{safe_filename}.csv"'})
    elif fmt == "json":
        import json
        content = json.dumps({"title": title, "track_count": len(req.tracks), "tracks": req.tracks}, indent=2)
        return Response(content=content, media_type="application/json", headers={"Content-Disposition": f'attachment; filename="{safe_filename}.json"'})
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported export format '{fmt}'")

# Static Files (only mounted when running standalone locally, as Vercel serves frontend/dist directly)
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if not os.environ.get("VERCEL") and FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="static")
