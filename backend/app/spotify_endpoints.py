from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from app.services.spotify_service import spotify_service

router = APIRouter()

class TrackToSave(BaseModel):
    id: str

class SpotifySaveRequest(BaseModel):
    original_playlist_id: str
    playlist_title: str
    final_track_ids: List[str]
    create_new: bool = False

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
        return RedirectResponse(url=f"/?auth_error={error}&platform=spotify")
    if not code:
        return RedirectResponse(url="/?auth_error=missing_code&platform=spotify")

    try:
        token_info = spotify_service.exchange_code(code, request=request)
        redirect_resp = RedirectResponse(url="/?auth_success=true&platform=spotify")
        spotify_service.set_session_cookie(redirect_resp, token_info, request=request)
        return redirect_resp
    except Exception as e:
        return RedirectResponse(url=f"/?auth_error={str(e)}&platform=spotify")

@router.post("/api/spotify/logout")
def logout(response: Response):
    spotify_service.logout(response=response)
    return {"status": "success", "message": "Logged out of Spotify"}

@router.post("/api/spotify/playlist/save")
def save_playlist(req: SpotifySaveRequest, request: Request, response: Response):
    sp = spotify_service.get_client(request=request, response=response)
    user_id = sp.me()['id']

    # Spotify playlist item replacement is very easy!
    # We can just replace all items in a playlist with PUT /playlists/{playlist_id}/tracks
    # BUT there is a limit of 100 tracks per request.
    uris = [f"spotify:track:{tid}" for tid in req.final_track_ids]

    if req.create_new:
        try:
            pl = sp.user_playlist_create(user=user_id, name=f"{req.playlist_title} (Clean)", public=False, description="Clean version created by CleanPlaylist")

            # Add tracks in chunks of 100
            for i in range(0, len(uris), 100):
                sp.playlist_add_items(pl['id'], uris[i:i+100])

            return {"status": "success", "message": "Created new playlist", "playlist_id": pl['id']}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        try:
            # Replace first 100
            if len(uris) > 0:
                sp.playlist_replace_items(req.original_playlist_id, uris[:100])
                # Add the rest
                for i in range(100, len(uris), 100):
                    sp.playlist_add_items(req.original_playlist_id, uris[i:i+100])
            else:
                sp.playlist_replace_items(req.original_playlist_id, [])

            return {"status": "success", "message": "Playlist updated", "playlist_id": req.original_playlist_id}
        except Exception as e:
            # Fallback to create new
            pl = sp.user_playlist_create(user=user_id, name=f"{req.playlist_title} (Clean)", public=False)
            for i in range(0, len(uris), 100):
                sp.playlist_add_items(pl['id'], uris[i:i+100])
            return {"status": "success", "message": "Created new playlist (fallback)", "playlist_id": pl['id']}


@router.get("/api/spotify/playlists")
def get_user_playlists(
    limit: int = 20, offset: int = 0, request: Request = None, response: Response = None
):
    sp_client = spotify_service.get_client(request=request, response=response) if request is not None else None
    return spotify_service.get_user_playlists(limit=limit, offset=offset, sp_client=sp_client)
