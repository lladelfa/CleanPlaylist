from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from typing import Dict, Any
from app.services.auth_service import auth_service
from app.services.ytmusic_service import ytmusic_service
import os

router = APIRouter()

@router.get("/api/auth/status")
def get_auth_status() -> Dict[str, bool]:
    return {"authenticated": auth_service.is_authenticated()}

@router.get("/api/auth/login")
def login():
    try:
        url = auth_service.get_login_url()
        # Return URL to frontend to do redirect, or redirect directly
        return {"status": "success", "url": url}
    except ValueError as ve:
        if str(ve) == "MISSING_CREDENTIALS":
            return {"status": "error", "code": "MISSING_CREDENTIALS", "message": "Google Cloud credentials missing in .env"}
        raise HTTPException(status_code=500, detail=str(ve))

@router.get("/api/auth/callback")
def auth_callback(code: str = None, error: str = None):
    if error:
        # Redirect back to frontend with error parameter
        return RedirectResponse(url=f"/?auth_error={error}")

    if not code:
        return RedirectResponse(url="/?auth_error=missing_code")

    try:
        auth_service.exchange_code(code)

        # Re-initialize YTMusic
        from app.services.auth_service import OAUTH_FILEPATH
        ytmusic_service.__init__(auth_filepath=str(OAUTH_FILEPATH))

        # Redirect back to the main frontend page
        return RedirectResponse(url="/?auth_success=true")
    except Exception as e:
        return RedirectResponse(url=f"/?auth_error={str(e)}")

@router.post("/api/auth/init_yt")
def init_ytmusic():
    """Re-initializes YTMusic with the auth file if present"""
    from app.services.auth_service import OAUTH_FILEPATH
    if auth_service.is_authenticated():
        ytmusic_service.__init__(auth_filepath=str(OAUTH_FILEPATH))
        return {"status": "success", "message": "YTMusic re-initialized with auth"}
    return {"status": "error", "message": "Not authenticated"}
