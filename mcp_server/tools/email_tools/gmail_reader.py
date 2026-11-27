import json
import os

from mcp_server.tools.base_tool import BaseTool

DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "data",
)


class GmailReaderTool(BaseTool):
    def __init__(self):
        super().__init__()
        self.name = "gmail_reader"
        self.description = (
            "Read emails from Gmail inbox, filtering out noise (newsletters, no-reply senders, etc.) "
            "and flagging emails that match the user's configured important terms."
        )
        self.input_schema = {
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "Session id used to load stored Gmail OAuth credentials and filters"},
                "max_results": {"type": "integer", "description": "Max emails to fetch"},
                "query": {"type": "string", "description": "Extra Gmail search query to AND with the configured filters"},
                "ignore_terms": {"type": "array", "items": {"type": "string"}, "description": "Senders/subject keywords to skip"},
                "important_terms": {"type": "array", "items": {"type": "string"}, "description": "Senders/subject keywords to flag as important"},
                "only_important": {"type": "boolean", "description": "If true, only return emails matching important_terms"},
            },
        }

    async def _get_credentials(self, session_id: str):
        if session_id:
            try:
                from backend.services.gmail_oauth_service import GmailOAuthService
                service = GmailOAuthService()
                creds = await service.get_gmail_credentials(session_id)
                if creds:
                    return creds
            except Exception:
                pass
        from google.oauth2.credentials import Credentials
        return Credentials.from_authorized_user_file("token.json")

    async def _get_filters(self, session_id: str, ignore_terms, important_terms, only_important, max_results):
        stored = {}
        if session_id:
            try:
                from backend.services.gmail_filter_repository import GmailFilterRepository
                stored = GmailFilterRepository().get(session_id)
            except Exception:
                stored = {}

        return {
            "ignore_terms": ignore_terms if ignore_terms is not None else stored.get("ignore_terms", []),
            "important_terms": important_terms if important_terms is not None else stored.get("important_terms", []),
            "only_important": only_important if only_important is not None else stored.get("only_important", False),
            "max_results": max_results if max_results is not None else stored.get("max_results", 10),
        }

    @staticmethod
    def _matches_any(headers: dict, terms: list) -> bool:
        haystack = f"{headers.get('From', '')} {headers.get('Subject', '')}".lower()
        return any(term.lower() in haystack for term in terms if term)

    @staticmethod
    def _build_query(user_query: str, ignore_terms: list) -> str:
        parts = [user_query] if user_query else []
        for term in ignore_terms or []:
            if term:
                parts.append(f'-"{term}"')
        return " ".join(parts) if parts else None

    def _write_important(self, session_id: str, important: list) -> str:
        os.makedirs(DATA_DIR, exist_ok=True)
        suffix = session_id or "default"
        path = os.path.join(DATA_DIR, f"gmail_important_{suffix}.json")
        with open(path, "w") as f:
            json.dump(important, f, indent=2)
        return path

    async def execute(
        self,
        session_id: str = None,
        max_results: int = None,
        query: str = None,
        ignore_terms: list = None,
        important_terms: list = None,
        only_important: bool = None,
    ) -> str:
        from googleapiclient.discovery import build

        filters = await self._get_filters(session_id, ignore_terms, important_terms, only_important, max_results)
        creds = await self._get_credentials(session_id)
        service = build("gmail", "v1", credentials=creds)

        effective_query = self._build_query(query, filters["ignore_terms"])
        results = (
            service.users()
            .messages()
            .list(userId="me", maxResults=filters["max_results"], q=effective_query)
            .execute()
        )
        messages = results.get("messages", [])

        important = []
        skipped_count = 0
        output = []
        for msg in messages[: filters["max_results"]]:
            message = service.users().messages().get(userId="me", id=msg["id"]).execute()
            headers = {h["name"]: h["value"] for h in message["payload"]["headers"]}
            entry = {
                "id": msg["id"],
                "from": headers.get("From"),
                "subject": headers.get("Subject"),
                "date": headers.get("Date"),
            }

            is_important = self._matches_any(headers, filters["important_terms"])
            if is_important:
                important.append(entry)

            if filters["only_important"] and not is_important:
                skipped_count += 1
                continue

            output.append(f"From: {entry['from']}\nSubject: {entry['subject']}\n")

        important_file = self._write_important(session_id, important)

        summary = "\n---\n".join(output)
        footer = (
            f"\n\n({len(important)} marked important, written to {important_file}; "
            f"{skipped_count} skipped by only_important filter)"
        )
        return summary + footer if summary else f"No matching emails.{footer}"
