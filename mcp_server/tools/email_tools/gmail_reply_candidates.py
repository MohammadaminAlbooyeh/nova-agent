from mcp_server.tools.base_tool import BaseTool
from mcp_server.tools.email_tools import gmail_common as common


class GmailReplyCandidatesTool(BaseTool):
    def __init__(self):
        super().__init__()
        self.name = "gmail_reply_candidates"
        self.description = (
            "List emails the user's auto-reply rules allow you to answer, with their full text. "
            "Use this first when asked to reply to emails, then call gmail_reply once per message "
            "you want to answer. Only messages returned here may be replied to."
        )
        self.input_schema = {
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "Gmail session id (filled in automatically)"},
            },
        }

    async def execute(self, session_id: str = None) -> str:
        filters = common.load_filters(session_id)
        if not filters.get("reply_enabled"):
            return (
                "Auto-reply is turned off. Ask the user to enable it under Connections > Auto-reply "
                "before replying to any email."
            )

        service = await common.build_service(session_id)
        me = service.users().getProfile(userId="me").execute().get("emailAddress", "").lower()

        query = ["in:inbox"]
        if filters.get("reply_only_unread", True):
            query.append("is:unread")
        if filters.get("reply_skip_ignored", True):
            query += [f'-"{t}"' for t in filters.get("ignore_terms", []) if t]
        limit = int(filters.get("reply_max_per_run", 5))

        listed = (
            service.users()
            .messages()
            .list(userId="me", q=" ".join(query), maxResults=min(limit * 4, 50))
            .execute()
            .get("messages", [])
        )
        handled = common.load_handled(session_id) if session_id else set()

        candidates, skipped = [], {}
        for ref in listed:
            if len(candidates) >= limit:
                break
            if ref["id"] in handled:
                skipped["already handled by the agent"] = skipped.get("already handled by the agent", 0) + 1
                continue
            message = service.users().messages().get(userId="me", id=ref["id"], format="full").execute()
            headers = common.headers_dict(message)
            last_sender_is_me = False
            if filters.get("reply_skip_already_replied", True):
                thread = (
                    service.users()
                    .threads()
                    .get(userId="me", id=message["threadId"], format="metadata", metadataHeaders=["From"])
                    .execute()
                )
                last = common.headers_dict(thread["messages"][-1]).get("From", "").lower()
                last_sender_is_me = bool(me) and me in last
            reason = common.reply_skip_reason(headers, message.get("labelIds", []), last_sender_is_me, filters)
            if reason:
                skipped[reason] = skipped.get(reason, 0) + 1
                continue
            candidates.append(
                f"message_id: {message['id']}\n"
                f"From: {headers.get('From')}\n"
                f"Subject: {headers.get('Subject')}\n"
                f"Date: {headers.get('Date')}\n"
                f"Body:\n{common.extract_body(message)}\n"
            )

        guidance = (
            f"Reply tone: {filters.get('reply_tone', 'friendly')}. "
            f"Mode: replies will be {'SENT immediately' if filters.get('reply_mode') == 'send' else 'saved as Gmail drafts'}."
        )
        if filters.get("reply_instructions"):
            guidance += f" User instructions for replies: {filters['reply_instructions']}"
        skipped_note = "; ".join(f"{n} skipped ({r})" for r, n in skipped.items()) or "nothing skipped"
        if not candidates:
            return f"No emails need a reply. {skipped_note}."
        return f"{guidance}\n({skipped_note})\n\n" + "\n---\n".join(candidates)
