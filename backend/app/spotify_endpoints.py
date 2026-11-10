from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import urllib.parse
import spotipy
from spotipy.exceptions import SpotifyException
from app.services.spotify_service import spotify_service

router = APIRouter()

class TrackToSave(BaseModel):
    id: str

class SpotifySaveRequest(BaseModel):
    original_playlist_id: Optional[str] = None
    playlist_title: str
    final_track_ids: List[str]
    create_new: bool = False
    is_public: bool = False

@router.get("/api/spotify/status")
def get_auth_status(request: Request, response: Response) -> Dict[str, bool]:
    return {"authenticated": spotify_service.is_authenticated(request=request, response=response)}

@router.get("/api/spotify/login")
def login(request: Request):
    try:
        url = spotify_service.get_login_url(request=request)
        return {"status": "success", "url": url}
    except ValueError as ve:
        if str(ve) == "MISSING_CREDENTIALS":
            return {"status": "error", "code": "MISSING_CREDENTIALS", "message": "Spotify credentials missing in .env"}
        raise HTTPException(status_code=500, detail=str(ve))

@router.get("/api/spotify/callback")
def auth_callback(request: Request, code: str = None, error: str = None):
    if error:
        safe_err = urllib.parse.quote_plus(str(error)[:200])
        redirect_resp = RedirectResponse(url=f"/?auth_error={safe_err}&platform=spotify")
        spotify_service.clear_session_cookie(redirect_resp)
        return redirect_resp
    if not code:
        redirect_resp = RedirectResponse(url="/?auth_error=missing_code&platform=spotify")
        spotify_service.clear_session_cookie(redirect_resp)
        return redirect_resp

    try:
        token_info = spotify_service.exchange_code(code, request=request)
        sp = spotipy.Spotify(auth=token_info.get("access_token"))
        sp.current_user()

        redirect_resp = RedirectResponse(url="/?auth_success=true&platform=spotify")
        spotify_service.set_session_cookie(redirect_resp, token_info, request=request)
        return redirect_resp
    except SpotifyException as se:
        if se.http_status == 403:
            redirect_resp = RedirectResponse(url="/?auth_error=allowlist_blocked&platform=spotify")
        else:
            safe_err = urllib.parse.quote_plus(str(se)[:200])
            redirect_resp = RedirectResponse(url=f"/?auth_error={safe_err}&platform=spotify")
        spotify_service.clear_session_cookie(redirect_resp)
        return redirect_resp
    except Exception as e:
        is_403 = getattr(e, "http_status", None) == 403 or getattr(getattr(e, "response", None), "status_code", None) == 403
        if is_403:
            redirect_resp = RedirectResponse(url="/?auth_error=allowlist_blocked&platform=spotify")
        else:
            safe_err = urllib.parse.quote_plus(str(e)[:200])
            redirect_resp = RedirectResponse(url=f"/?auth_error={safe_err}&platform=spotify")
        spotify_service.clear_session_cookie(redirect_resp)
        return redirect_resp

@router.post("/api/spotify/logout")
def logout(response: Response):
    spotify_service.logout(response=response)
    return {"status": "success", "message": "Logged out of Spotify"}

@router.post("/api/spotify/playlist/save")
def save_playlist(req: SpotifySaveRequest, request: Request, response: Response):
    sp = spotify_service.get_client(request=request, response=response)

    uris = [f"spotify:track:{tid}" for tid in req.final_track_ids]

    if req.create_new:
        try:
            pl = sp.current_user_playlist_create(
                name=req.playlist_title,
                public=req.is_public,
                description="Clean version created by CleanPlaylist"
            )

            # Add tracks in chunks of 100
            for i in range(0, len(uris), 100):
                chunk = uris[i:i+100]
                if chunk:
                    sp.playlist_add_items(pl['id'], chunk)

            return {"status": "success", "message": "Created new playlist", "playlist_id": pl['id']}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        if not req.original_playlist_id:
            raise HTTPException(status_code=400, detail="original_playlist_id required when create_new is False")

        try:
            # Replace first 100
            if len(uris) > 0:
                sp.playlist_replace_items(req.original_playlist_id, uris[:100])
                # Add the rest
                for i in range(100, len(uris), 100):
                    chunk = uris[i:i+100]
                    if chunk:
                        sp.playlist_add_items(req.original_playlist_id, chunk)
            else:
                sp.playlist_replace_items(req.original_playlist_id, [])

            return {"status": "success", "message": "Playlist updated", "playlist_id": req.original_playlist_id}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/spotify/playlists")
def get_user_playlists(
    limit: int = 20, offset: int = 0, request: Request = None, response: Response = None
):
    sp_client = spotify_service.get_client(request=request, response=response) if request is not None else None
    return spotify_service.get_user_playlists(limit=limit, offset=offset, sp_client=sp_client)
