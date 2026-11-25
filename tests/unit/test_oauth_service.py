"""
Unit tests for OAuth Service - Gmail authentication flow.
"""
import os
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.gmail_oauth_service import GmailOAuthService
from backend.services.oauth_repository import OAuthRepository


@pytest.fixture(autouse=True)
def google_oauth_env(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")


@pytest.fixture
def oauth_repository():
    """Create mock OAuth repository matching OAuthRepository's real interface."""
    repo = MagicMock(spec=OAuthRepository)
    repo.create = AsyncMock(return_value=MagicMock(id="token_1"))
    repo.get_by_session_and_provider = AsyncMock(return_value=None)
    repo.update = AsyncMock(return_value=True)
    repo.delete = AsyncMock(return_value=True)
    repo.revoke_by_session_and_provider = AsyncMock(return_value=True)
    repo.get_decrypted_access_token = AsyncMock(return_value="decrypted_access_token")
    repo.get_decrypted_refresh_token = AsyncMock(return_value="decrypted_refresh_token")
    repo.get_client_credentials = AsyncMock(return_value=None)
    repo.save_client_credentials = AsyncMock(return_value=MagicMock())
    repo.delete_client_credentials = AsyncMock(return_value=True)
    return repo


@pytest.fixture
def oauth_service(oauth_repository):
    """Create OAuth service for testing."""
    return GmailOAuthService(oauth_repository)


def _mock_httpx_post(json_data: dict, status_code: int = 200):
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.json.return_value = json_data
    mock_response.text = str(json_data)

    mock_client = MagicMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return mock_client


def _token_model(**overrides):
    model = MagicMock()
    model.id = overrides.get("id", "token_1")
    model.refresh_token = overrides.get("refresh_token", "stored_refresh_token")
    model.user_email = overrides.get("user_email", "user@example.com")
    model.token_expiry = overrides.get("token_expiry", datetime.now() + timedelta(hours=1))
    model.is_expired = MagicMock(return_value=overrides.get("is_expired", False))
    return model


@pytest.mark.asyncio
async def test_get_auth_url(oauth_service):
    """Test generating authorization URL."""
    session_id = "test_session_123"
    auth_url = await oauth_service.get_auth_url(session_id)

    assert auth_url is not None
    assert isinstance(auth_url, str)
    assert "accounts.google.com" in auth_url
    assert "client_id" in auth_url
    assert "scope" in auth_url
    assert f"state={session_id}" in auth_url


@pytest.mark.asyncio
async def test_exchange_code_for_token(oauth_service, oauth_repository):
    """Test exchanging authorization code for token."""
    session_id = "test_session_123"
    auth_code = "test_auth_code_123"

    token_response = {
        "access_token": "test_access_token",
        "refresh_token": "test_refresh_token",
        "expires_in": 3600,
        "token_type": "Bearer",
        "scope": "gmail.readonly gmail.send",
    }

    with patch("httpx.AsyncClient", return_value=_mock_httpx_post(token_response)):
        with patch.object(oauth_service, "_get_user_email", AsyncMock(return_value="user@example.com")):
            success = await oauth_service.exchange_code_for_token(auth_code, session_id)

    assert success is True
    oauth_repository.create.assert_called_once()


@pytest.mark.asyncio
async def test_get_auth_status(oauth_service, oauth_repository):
    """Test getting authentication status."""
    session_id = "test_session_123"
    oauth_repository.get_by_session_and_provider.return_value = _token_model(is_expired=False)

    status = await oauth_service.get_auth_status(session_id)

    assert status is not None
    assert isinstance(status, dict)
    assert status["authenticated"] is True


@pytest.mark.asyncio
async def test_disconnect_gmail(oauth_service, oauth_repository):
    """Test disconnecting Gmail authorization."""
    session_id = "test_session_123"

    success = await oauth_service.disconnect_gmail(session_id)

    assert success is True
    oauth_repository.revoke_by_session_and_provider.assert_called_once_with(session_id, "gmail")


@pytest.mark.asyncio
async def test_refresh_token(oauth_service, oauth_repository):
    """Test refreshing expired access token."""
    session_id = "test_session_123"
    oauth_repository.get_by_session_and_provider.return_value = _token_model()

    new_token_response = {
        "access_token": "new_access_token",
        "expires_in": 3600,
        "token_type": "Bearer",
    }

    with patch("httpx.AsyncClient", return_value=_mock_httpx_post(new_token_response)):
        success = await oauth_service.refresh_gmail_token(session_id)

    assert success is True
    oauth_repository.update.assert_called_once()


@pytest.mark.asyncio
async def test_get_gmail_credentials(oauth_service, oauth_repository):
    """Test retrieving Gmail credentials."""
    session_id = "test_session_123"
    oauth_repository.get_by_session_and_provider.return_value = _token_model(is_expired=False)

    creds = await oauth_service.get_gmail_credentials(session_id)

    assert creds is not None


@pytest.mark.asyncio
async def test_invalid_auth_code(oauth_service, oauth_repository):
    """Test handling invalid authorization code."""
    session_id = "test_session_123"
    invalid_code = "invalid_code"

    with patch("httpx.AsyncClient", return_value=_mock_httpx_post({"error": "invalid_code"}, status_code=400)):
        success = await oauth_service.exchange_code_for_token(invalid_code, session_id)

    assert success is False


@pytest.mark.asyncio
async def test_no_stored_token(oauth_service, oauth_repository):
    """Test behavior when no token stored."""
    session_id = "test_session_123"
    oauth_repository.get_by_session_and_provider.return_value = None

    status = await oauth_service.get_auth_status(session_id)

    assert status is not None
    assert status.get("authenticated") is False


@pytest.mark.asyncio
async def test_token_encryption():
    """Test that tokens are encrypted when stored (via the real repository)."""
    real_repo = OAuthRepository()
    plaintext = "secret_access_token"
    encrypted = real_repo.encryption.encrypt(plaintext)

    assert encrypted != plaintext
    assert real_repo.encryption.decrypt(encrypted) == plaintext
