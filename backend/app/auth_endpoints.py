from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from pydantic import BaseModel
from app.services.auth_service import auth_service
from app.services.ytmusic_service import ytmusic_service, YTMusicService
import os

router = APIRouter()

class AuthCheckRequest(BaseModel):
    user_code: str

@router.get("/api/auth/status")
def get_auth_status() -> Dict[str, bool]:
    return {"authenticated": auth_service.is_authenticated()}

@router.post("/api/auth/start")
def start_auth() -> Dict[str, Any]:
    try:
        return auth_service.start_oauth_flow()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/auth/check")
def check_auth(req: AuthCheckRequest) -> Dict[str, str]:
    return auth_service.check_oauth_status(req.user_code)

@router.post("/api/auth/init_yt")
def init_ytmusic():
    """Re-initializes YTMusic with the oauth file if present"""
    from app.services.auth_service import OAUTH_FILEPATH
    if auth_service.is_authenticated():
        # Update the global ytmusic_service instance
        ytmusic_service.__init__(auth_filepath=str(OAUTH_FILEPATH))
        return {"status": "success", "message": "YTMusic re-initialized with auth"}
    return {"status": "error", "message": "Not authenticated"}
