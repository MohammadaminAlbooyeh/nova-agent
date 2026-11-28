import base64
from email.message import EmailMessage

from mcp_server.tools.base_tool import BaseTool
from mcp_server.tools.email_tools import gmail_common as common


class GmailReplyTool(BaseTool):
    def __init__(self):
        super().__init__()
        self.name = "gmail_reply"
        self.description = (
            "Reply to one email in its original thread. The user's auto-reply rules decide whether the "
            "reply is sent or saved as a draft, and which emails may be answered; call "
            "gmail_reply_candidates first and only reply to messages it returned."
        )
        self.input_schema = {
            "type": "object",
            "properties": {
                "session_id": {"type": "string", "description": "Gmail session id (filled in automatically)"},
                "message_id": {"type": "string", "description": "message_id from gmail_reply_candidates"},
                "body": {"type": "string", "description": "The reply text (no quoted original, no subject)"},
            },
            "required": ["message_id", "body"],
        }

    async def execute(self, message_id: str, body: str, session_id: str = None) -> str:
        filters = common.load_filters(session_id)
        if not filters.get("reply_enabled"):
            return "Auto-reply is turned off. Ask the user to enable it under Connections > Auto-reply."
        if not body or not body.strip():
            return "Refusing to send an empty reply."

        service = await common.build_service(session_id)
        me = service.users().getProfile(userId="me").execute().get("emailAddress", "").lower()
        message = service.users().messages().get(userId="me", id=message_id, format="full").execute()
        headers = common.headers_dict(message)

        thread = (
            service.users()
            .threads()
            .get(userId="me", id=message["threadId"], format="metadata", metadataHeaders=["From"])
            .execute()
        )
        last = common.headers_dict(thread["messages"][-1]).get("From", "").lower()
        last_sender_is_me = bool(me) and me in last

        # Re-check the rules here, not just when listing candidates, so the model
        # cannot reply to a message the user's filters exclude.
        reason = common.reply_skip_reason(headers, message.get("labelIds", []), last_sender_is_me, filters)
        if reason:
            return f"Not replying: this email is excluded by the auto-reply rules ({reason})."
        if session_id and message_id in common.load_handled(session_id):
            return "Not replying: the agent already handled this email."

        subject = headers.get("Subject", "")
        reply = EmailMessage()
        reply.set_content(body.strip())
        reply["To"] = headers.get("Reply-To") or headers.get("From")
        reply["Subject"] = subject if subject.lower().startswith("re:") else f"Re: {subject}"
        original_id = headers.get("Message-ID") or headers.get("Message-Id")
        if original_id:
            reply["In-Reply-To"] = original_id
            reply["References"] = f"{headers.get('References', '')} {original_id}".strip()

        payload = {
            "raw": base64.urlsafe_b64encode(reply.as_bytes()).decode(),
            "threadId": message["threadId"],
        }
        if filters.get("reply_mode") == "send":
            service.users().messages().send(userId="me", body=payload).execute()
            outcome = f"Reply sent to {reply['To']}"
        else:
            service.users().drafts().create(userId="me", body={"message": payload}).execute()
            outcome = f"Reply saved as a Gmail draft for {reply['To']} (not sent)"

        if session_id:
            common.mark_handled(session_id, message_id)
        return outcome
