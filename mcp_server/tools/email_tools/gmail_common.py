"""Shared helpers for the Gmail tools: credentials, filters, message parsing,
and the reply-eligibility rules the user configures in the UI."""
import base64
import json
import os
import re
from typing import Optional

DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "data",
)

MAX_BODY_CHARS = 3000


async def get_credentials(session_id: Optional[str]):
    """Credentials for the Gmail account connected on the Connections page,
    falling back to a local token.json for CLI/dev use."""
    if session_id:
        try:
            from backend.services.gmail_oauth_service import GmailOAuthService

            creds = await GmailOAuthService().get_gmail_credentials(session_id)
            if creds:
                return creds
        except Exception:
            pass
    from google.oauth2.credentials import Credentials

    return Credentials.from_authorized_user_file("token.json")


async def build_service(session_id: Optional[str]):
    from googleapiclient.discovery import build

    return build("gmail", "v1", credentials=await get_credentials(session_id))


def load_filters(session_id: Optional[str]) -> dict:
    from backend.services.gmail_filter_repository import DEFAULT_FILTERS, GmailFilterRepository

    if not session_id:
        return dict(DEFAULT_FILTERS)
    try:
        return GmailFilterRepository().get(session_id)
    except Exception:
        return dict(DEFAULT_FILTERS)


def headers_dict(message: dict) -> dict:
    return {h["name"]: h["value"] for h in message.get("payload", {}).get("headers", [])}


def extract_body(message: dict, limit: int = MAX_BODY_CHARS) -> str:
    """Plain-text body of a Gmail message (falls back to tag-stripped HTML)."""

    def decode(data: str) -> str:
        return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)).decode("utf-8", errors="replace")

    plain, html = [], []

    def walk(part: dict):
        mime = part.get("mimeType", "")
        data = part.get("body", {}).get("data")
        if data and mime == "text/plain":
            plain.append(decode(data))
        elif data and mime == "text/html":
            html.append(decode(data))
        for sub in part.get("parts", []) or []:
            walk(sub)

    walk(message.get("payload", {}))
    if plain:
        text = "\n".join(plain)
    else:
        text = re.sub(r"<[^>]+>", " ", "\n".join(html))
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text if len(text) <= limit else text[:limit] + "... [truncated]"


def matches_any(haystack: str, terms: list) -> bool:
    haystack = (haystack or "").lower()
    return any(t.lower() in haystack for t in terms or [] if t)


def is_automated(headers: dict) -> bool:
    """Bulk mail, mailing lists and auto-responders: replying is useless or harmful."""
    if "List-Unsubscribe" in headers or "List-Id" in headers:
        return True
    if headers.get("Precedence", "").lower() in {"bulk", "list", "junk"}:
        return True
    auto = headers.get("Auto-Submitted", "no").lower()
    return auto != "no"


def reply_skip_reason(
    headers: dict,
    labels: list,
    last_sender_is_me: bool,
    filters: dict,
) -> Optional[str]:
    """Why the agent must NOT reply to this message, or None if it may.

    Pure function over already-fetched data so the rules are unit-testable and
    enforced identically when listing candidates and when sending a reply.
    """
    sender = headers.get("From", "")
    haystack = f"{sender} {headers.get('Subject', '')}"

    if filters.get("reply_skip_ignored", True) and matches_any(haystack, filters.get("ignore_terms", [])):
        return "matches an ignore term"
    if filters.get("reply_skip_automated", True) and is_automated(headers):
        return "automated or mailing-list mail"
    if filters.get("reply_only_unread", True) and "UNREAD" not in labels:
        return "already read"
    if filters.get("reply_only_important", False) and not matches_any(haystack, filters.get("important_terms", [])):
        return "not marked important"
    allowed = filters.get("reply_allowed_senders") or []
    if allowed and not matches_any(sender, allowed):
        return "sender not in the allowed list"
    if filters.get("reply_skip_already_replied", True) and last_sender_is_me:
        return "last message in the thread is already yours"
    return None


# ---- tracking of messages the agent already handled (so drafts aren't duplicated) ----

def _handled_path(session_id: str) -> str:
    return os.path.join(DATA_DIR, f"gmail_replied_{session_id}.json")


def load_handled(session_id: str) -> set:
    try:
        with open(_handled_path(session_id)) as f:
            return set(json.load(f))
    except Exception:
        return set()


def mark_handled(session_id: str, message_id: str) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    ids = load_handled(session_id)
    ids.add(message_id)
    with open(_handled_path(session_id), "w") as f:
        json.dump(sorted(ids), f)
