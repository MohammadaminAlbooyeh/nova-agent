from datetime import datetime
from backend.models.database import Base
from sqlalchemy import Column, String, DateTime
import uuid


class OAuthClientCredentialsModel(Base):
    """Per-session, user-supplied OAuth app credentials (e.g. a user's own
    Google Cloud OAuth client), as an alternative to operator-wide
    GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET env vars."""

    __tablename__ = "oauth_client_credentials"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, nullable=False, index=True)
    provider = Column(String, nullable=False)
    client_id = Column(String, nullable=False)
    client_secret = Column(String, nullable=False)  # encrypted at rest
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
