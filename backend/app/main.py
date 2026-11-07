"""Main FastAPI application for CleanPlaylist."""

import os
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ConfigDict
from dotenv import load_dotenv

from app.config import PRESET_PROFILES, WORD_CATEGORIES
from app.services.scanner_service import scanner_service
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

class PlaylistScanRequest(BaseModel):
    tracks: List[TrackScanItem]
    preset: Optional[str] = "moderate"
    custom_blocklist: Optional[List[str]] = Field(default_factory=list)
    deep_scan_lyrics: Optional[bool] = False
    max_deep_scan: Optional[int] = 20
    platform: Optional[str] = "ytmusic"

class SingleTrackScanRequest(BaseModel):
    video_id: str
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
        "categories": {k: sorted(list(v)) for k, v in WORD_CATEGORIES.items()}
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

@app.post("/api/scan/playlist")
def scan_playlist(req: PlaylistScanRequest):
    results = []
    deep_scanned_count = 0
    service = spotify_service if req.platform == "spotify" else ytmusic_service

    # Pre-fetch lyrics concurrently for tracks eligible for deep scan to avoid serverless timeouts
    lyrics_by_id: Dict[str, Optional[str]] = {}
    if req.deep_scan_lyrics:
        max_to_scan = req.max_deep_scan or 20
        tracks_for_lyrics = req.tracks[:max_to_scan]
        with ThreadPoolExecutor(max_workers=8) as executor:
            fetched = list(executor.map(lambda t: (t.id, service.get_track_lyrics(t.id)), tracks_for_lyrics))
        for track_id, text in fetched:
            if text:
                lyrics_by_id[track_id] = text
                deep_scanned_count += 1

    for track in req.tracks:
        lyrics = lyrics_by_id.get(track.id)
        has_lyrics = bool(lyrics)

        scan_result = scanner_service.scan_lyrics(
            lyrics=lyrics or "",
            preset=req.preset or "moderate",
            custom_blocklist=req.custom_blocklist or [],
            is_metadata_explicit=bool(track.is_explicit)
        )

        track_dict = track.model_dump()
        track_dict.update({
            "is_flagged": scan_result["is_flagged"],
            "reasons": scan_result["reasons"],
            "detected_terms": scan_result["detected_terms"],
            "total_flagged_count": scan_result["total_flagged_count"],
            "snippets": scan_result["snippets"],
            "has_lyrics": has_lyrics or scan_result["has_lyrics"],
        })
        results.append(track_dict)

    flagged_count = sum(1 for t in results if t["is_flagged"])

    return {
        "tracks": results,
        "summary": {
            "total_tracks": len(results),
            "flagged_tracks": flagged_count,
            "clean_tracks": len(results) - flagged_count,
            "deep_scanned_tracks": deep_scanned_count,
        }
    }

@app.post("/api/scan/track-lyrics")
def scan_single_track_lyrics(req: SingleTrackScanRequest):
    service = spotify_service if req.platform == "spotify" else ytmusic_service
    lyrics = service.get_track_lyrics(req.video_id)
    if not lyrics:
        return {
            "has_lyrics": False,
            "lyrics": None,
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
    tracks_to_process = req.tracks[: req.max_tracks or 30]
    service = spotify_service if req.platform == "spotify" else ytmusic_service

    # Fetch lyrics concurrently across worker threads to keep response fast on serverless
    with ThreadPoolExecutor(max_workers=8) as executor:
        lyrics_list = list(executor.map(lambda t: service.get_track_lyrics(t.id), tracks_to_process))

    for track, lyrics in zip(tracks_to_process, lyrics_list):
        if not lyrics:
            per_track_results.append({
                "id": track.id,
                "title": track.title,
                "artist": track.artist,
                "thumbnail": track.thumbnail,
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
        },
        "results": per_track_results
    }

@app.post("/api/replacements/find")
def find_clean_replacement(req: FindCleanReplacementRequest, request: Request, response: Response):
    if req.platform == "spotify":
        sp_client = spotify_service.get_client(request=request, response=response)
        candidate = spotify_service.search_clean_replacement(
            title=req.title,
            artist=req.artist,
            duration_seconds=req.duration_seconds or 0,
            sp_client=sp_client,
        )
    else:
        candidate = ytmusic_service.search_clean_replacement(
            title=req.title,
            artist=req.artist,
            duration_seconds=req.duration_seconds or 0
        )
    return {
        "found": candidate is not None,
        "clean_candidate": candidate
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
