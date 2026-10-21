from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from pydantic import BaseModel
from app.services.auth_service import auth_service
from app.services.ytmusic_service import ytmusic_service
import os

router = APIRouter()

class AuthHeadersRequest(BaseModel):
    headers_raw: str

@router.get("/api/auth/status")
def get_auth_status() -> Dict[str, bool]:
    return {"authenticated": auth_service.is_authenticated()}

@router.post("/api/auth/headers")
def auth_with_headers(req: AuthHeadersRequest) -> Dict[str, Any]:
    res = auth_service.process_headers(req.headers_raw)
    if res["status"] == "success":
        # Re-init global ytmusic service instantly
        from app.services.auth_service import OAUTH_FILEPATH
        ytmusic_service.__init__(auth_filepath=str(OAUTH_FILEPATH))
    return res

@router.post("/api/auth/init_yt")
def init_ytmusic():
    """Re-initializes YTMusic with the auth file if present"""
    from app.services.auth_service import OAUTH_FILEPATH
    if auth_service.is_authenticated():
        ytmusic_service.__init__(auth_filepath=str(OAUTH_FILEPATH))
        return {"status": "success", "message": "YTMusic re-initialized with auth"}
    return {"status": "error", "message": "Not authenticated"}
