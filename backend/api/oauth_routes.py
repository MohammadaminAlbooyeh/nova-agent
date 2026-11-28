from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Literal, Optional, List
from backend.services.gmail_oauth_service import GmailOAuthService
from backend.services.oauth_repository import OAuthRepository
from backend.services.gmail_filter_repository import GmailFilterRepository
from backend.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/oauth", tags=["oauth"])

_gmail_oauth_service = None
_oauth_repository = None
_gmail_filter_repository = None


def get_gmail_oauth_service() -> GmailOAuthService:
    global _gmail_oauth_service
    if _gmail_oauth_service is None:
        _oauth_repository = OAuthRepository()
        _gmail_oauth_service = GmailOAuthService(_oauth_repository)
    return _gmail_oauth_service


def get_gmail_filter_repository() -> GmailFilterRepository:
    global _gmail_filter_repository
    if _gmail_filter_repository is None:
        _gmail_filter_repository = GmailFilterRepository()
    return _gmail_filter_repository


class AuthorizeRequest(BaseModel):
    session_id: str
    provider: str = "gmail"


class ClientCredentialsRequest(BaseModel):
    client_id: Optional[str] = None
    client_secret: Optional[str] = None


class CallbackRequest(BaseModel):
    code: str
    session_id: str
    provider: str = "gmail"


class AuthStatusResponse(BaseModel):
    authenticated: bool
    user_email: Optional[str]
    is_expired: Optional[bool]
    expires_at: Optional[str]


class GmailFiltersRequest(BaseModel):
    ignore_terms: Optional[List[str]] = Field(
        default=None, description="Senders/subject keywords the agent should skip (e.g. newsletters, noreply)"
    )
    important_terms: Optional[List[str]] = Field(
        default=None, description="Senders/subject keywords that mark an email as important"
    )
    only_important: Optional[bool] = Field(
        default=None, description="If true, the agent only surfaces emails matching important_terms"
    )
    max_results: Optional[int] = Field(default=None, description="Max emails to scan per read")

    # Auto-reply rules
    reply_enabled: Optional[bool] = Field(default=None, description="Allow the agent to reply to emails at all")
    reply_mode: Optional[Literal["draft", "send"]] = Field(
        default=None, description="'draft' saves replies as Gmail drafts, 'send' sends them immediately"
    )
    reply_only_important: Optional[bool] = Field(default=None, description="Only reply to emails matching important_terms")
    reply_only_unread: Optional[bool] = Field(default=None, description="Only reply to unread emails")
    reply_skip_ignored: Optional[bool] = Field(default=None, description="Never reply to emails matching ignore_terms")
    reply_skip_automated: Optional[bool] = Field(default=None, description="Never reply to bulk/mailing-list/automated mail")
    reply_skip_already_replied: Optional[bool] = Field(
        default=None, description="Skip threads where the last message is already from the user"
    )
    reply_allowed_senders: Optional[List[str]] = Field(
        default=None, description="If non-empty, only reply to senders containing one of these terms"
    )
    reply_max_per_run: Optional[int] = Field(default=None, ge=1, le=25, description="Max replies per agent run")
    reply_tone: Optional[Literal["friendly", "formal", "brief"]] = Field(default=None, description="Tone for replies")
    reply_instructions: Optional[str] = Field(
        default=None, max_length=500, description="Extra guidance for the agent when writing replies"
    )


@router.post("/authorize/{provider}")
async def authorize(
    provider: str,
    session_id: str = Query(...),
    credentials: ClientCredentialsRequest = ClientCredentialsRequest(),
    gmail_service: GmailOAuthService = Depends(get_gmail_oauth_service),
) -> dict:
    """
    Get OAuth authorization URL for provider.

    Initiates OAuth 2.0 flow by returning an authorization URL that user
    should visit in their browser to grant permission.

    Args:
        provider (str): OAuth provider (currently: "gmail")
        session_id (str): Session identifier for token storage

    Returns:
        dict: Authorization URL to redirect user to

    Example Response:
        ```json
        {
            "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
            "provider": "gmail"
        }
        ```

    Supported Providers:
    - gmail: Google Gmail API access
    """
    try:
        if provider != "gmail":
            raise HTTPException(status_code=400, detail=f"Provider '{provider}' not supported")

        auth_url = await gmail_service.get_auth_url(session_id, credentials.client_id, credentials.client_secret)
        return {"auth_url": auth_url, "provider": provider}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to generate auth URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/callback/{provider}")
async def callback(
    provider: str,
    request: CallbackRequest,
    gmail_service: GmailOAuthService = Depends(get_gmail_oauth_service),
) -> dict:
    """
    Handle OAuth callback and exchange authorization code for access token.

    Called by OAuth provider after user grants permission. Exchanges the
    authorization code for an access token and refresh token. Tokens are
    encrypted and stored per session.

    Args:
        provider (str): OAuth provider (currently: "gmail")
        request (CallbackRequest): Contains authorization code and session_id

    Returns:
        dict: Success confirmation with user email

    Example Request:
        ```json
        {
            "code": "4/0AX4XfWh...",
            "session_id": "sess_123...",
            "provider": "gmail"
        }
        ```

    Token Storage:
    - Encrypted with ENCRYPTION_KEY from environment
    - Stored in database per session
    - Auto-refreshed when expired
    """
    try:
        if provider != "gmail":
            raise HTTPException(status_code=400, detail=f"Provider '{provider}' not supported")

        success = await gmail_service.exchange_code_for_token(request.code, request.session_id)

        if not success:
            raise HTTPException(status_code=400, detail="Failed to exchange authorization code for token")

        status = await gmail_service.get_auth_status(request.session_id)
        return {
            "success": True,
            "provider": provider,
            "user_email": status.get("user_email"),
            "message": f"Successfully authenticated with {provider}",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OAuth callback failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{provider}", response_model=AuthStatusResponse)
async def get_status(
    provider: str,
    session_id: str = Query(...),
    gmail_service: GmailOAuthService = Depends(get_gmail_oauth_service),
) -> AuthStatusResponse:
    """
    Check OAuth authentication status for a provider.

    Returns authentication status including whether token is valid and
    when it expires. Useful for UI to show auth state and refresh buttons.

    Args:
        provider (str): OAuth provider (currently: "gmail")
        session_id (str): Session identifier

    Returns:
        AuthStatusResponse: Authentication status with expiry info

    Example Response:
        ```json
        {
            "authenticated": true,
            "user_email": "user@example.com",
            "is_expired": false,
            "expires_at": "2024-01-15T10:30:00Z"
        }
        ```
    """
    try:
        if provider != "gmail":
            raise HTTPException(status_code=400, detail=f"Provider '{provider}' not supported")

        status = await gmail_service.get_auth_status(session_id)
        return AuthStatusResponse(
            authenticated=status.get("authenticated", False),
            user_email=status.get("user_email"),
            is_expired=status.get("is_expired"),
            expires_at=status.get("expires_at"),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get auth status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/disconnect/{provider}")
async def disconnect(
    provider: str,
    session_id: str = Query(...),
    gmail_service: GmailOAuthService = Depends(get_gmail_oauth_service),
) -> dict:
    """
    Revoke OAuth credentials and disconnect from provider.

    Removes stored access token and refresh token for this session.
    User will need to re-authenticate to use provider features again.

    Args:
        provider (str): OAuth provider (currently: "gmail")
        session_id (str): Session identifier

    Returns:
        dict: Success confirmation
    """
    try:
        if provider != "gmail":
            raise HTTPException(status_code=400, detail=f"Provider '{provider}' not supported")

        success = await gmail_service.disconnect_gmail(session_id)

        if not success:
            raise HTTPException(status_code=400, detail="Failed to disconnect provider")

        return {"success": True, "message": f"Disconnected from {provider}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to disconnect: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh/{provider}")
async def refresh_token(
    provider: str,
    session_id: str = Query(...),
    gmail_service: GmailOAuthService = Depends(get_gmail_oauth_service),
) -> dict:
    """
    Manually refresh OAuth access token.

    Exchanges refresh token for new access token. Usually called automatically
    when token expires, but can be called manually to ensure fresh token.

    Args:
        provider (str): OAuth provider (currently: "gmail")
        session_id (str): Session identifier

    Returns:
        dict: Success confirmation with refresh status
    """
    try:
        if provider != "gmail":
            raise HTTPException(status_code=400, detail=f"Provider '{provider}' not supported")

        success = await gmail_service.refresh_gmail_token(session_id)

        if not success:
            raise HTTPException(status_code=400, detail="Failed to refresh token")

        return {"success": True, "message": f"Token refreshed for {provider}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to refresh token: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gmail/filters")
async def get_gmail_filters(
    session_id: str = Query(...),
    filter_repo: GmailFilterRepository = Depends(get_gmail_filter_repository),
) -> dict:
    """
    Get the Gmail reading filters configured for this session.

    These control which emails the agent is allowed to treat as "important"
    versus skip as noise (newsletters, no-reply senders, etc.) when it reads
    the inbox.
    """
    try:
        return filter_repo.get(session_id)
    except Exception as e:
        logger.error(f"Failed to get Gmail filters: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/gmail/filters")
async def save_gmail_filters(
    request: GmailFiltersRequest,
    session_id: str = Query(...),
    filter_repo: GmailFilterRepository = Depends(get_gmail_filter_repository),
) -> dict:
    """
    Save Gmail reading filters for this session.

    Only fields provided in the request are updated; omitted fields keep
    their previous value (or the default on first save).
    """
    try:
        updates = {k: v for k, v in request.model_dump().items() if v is not None}
        saved = filter_repo.save(session_id, updates)
        return saved
    except Exception as e:
        logger.error(f"Failed to save Gmail filters: {e}")
        raise HTTPException(status_code=500, detail=str(e))
