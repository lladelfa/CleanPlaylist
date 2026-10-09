from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.services.ytmusic_service import ytmusic_service
from app.services.auth_service import auth_service

router = APIRouter()

class TrackSwap(BaseModel):
    original_set_video_id: str
    original_video_id: str
    new_video_id: str

class SavePlaylistRequest(BaseModel):
    original_playlist_id: str
    playlist_title: str
    # If we are updating an existing playlist, we need to know exactly what to remove and add
    swaps: Optional[List[TrackSwap]] = []
    # If we are creating a new playlist, we just need the final list of track IDs
    final_track_ids: List[str]
    create_new: bool = False

def _create_new_playlist(yt, title: str, track_ids: List[str]):
    try:
        clean_title = f"{title}_clean"
        # ytmusicapi create_playlist
        playlist_id = yt.create_playlist(clean_title, "Clean version created by CleanPlaylist")
        if isinstance(playlist_id, dict):
             # Sometimes it returns a dict
             playlist_id = playlist_id.get("id") or playlist_id

        # Add tracks
        # yt.add_playlist_items allows adding up to 200 items at once?
        if track_ids:
            yt.add_playlist_items(playlist_id, track_ids)
        return {"status": "success", "message": f"Created new playlist '{clean_title}'", "playlist_id": playlist_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create new playlist: {str(e)}")

@router.post("/api/playlist/save")
def save_playlist(req: SavePlaylistRequest):
    if not auth_service.is_authenticated():
        raise HTTPException(status_code=401, detail="User is not authenticated with YouTube Music.")

    yt = ytmusic_service.yt

    if req.create_new:
        return _create_new_playlist(yt, req.playlist_title, req.final_track_ids)

    try:
        # Try to modify the existing playlist.
        # 1. Remove the old tracks
        if req.swaps:
            videos_to_remove = [
                {"videoId": swap.original_video_id, "setVideoId": swap.original_set_video_id}
                for swap in req.swaps if swap.original_set_video_id
            ]
            if videos_to_remove:
                yt.remove_playlist_items(req.original_playlist_id, videos_to_remove)

            # 2. Add the new tracks (this adds them to the end of the playlist, which is a limitation of YTMusic API
            # without reordering, but it achieves the goal of swapping them out)
            videos_to_add = [swap.new_video_id for swap in req.swaps]
            if videos_to_add:
                yt.add_playlist_items(req.original_playlist_id, videos_to_add)

        return {"status": "success", "message": "Playlist updated successfully", "playlist_id": req.original_playlist_id}
    except Exception as e:
        # If modifying fails (e.g., user doesn't own it), fallback to creating a new one
        print(f"Failed to update playlist {req.original_playlist_id}: {e}")
        return _create_new_playlist(yt, req.playlist_title, req.final_track_ids)
