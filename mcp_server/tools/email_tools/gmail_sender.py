from mcp_server.tools.base_tool import BaseTool


class GmailSenderTool(BaseTool):
    def __init__(self):
        super().__init__()
        self.name = "gmail_sender"
        self.description = "Send emails via Gmail"
        self.input_schema = {
            "type": "object",
            "properties": {
                "to": {"type": "string", "description": "Recipient email"},
                "subject": {"type": "string", "description": "Email subject"},
                "body": {"type": "string", "description": "Email body"},
                "session_id": {"type": "string", "description": "Gmail session id (filled in automatically)"},
            },
            "required": ["to", "subject", "body"],
        }

    async def execute(self, to: str, subject: str, body: str, session_id: str = None) -> str:
        import base64
        from email.message import EmailMessage
        from mcp_server.tools.email_tools.gmail_common import build_service
        service = await build_service(session_id)
        message = EmailMessage()
        message.set_content(body)
        message["To"] = to
        message["Subject"] = subject
        encoded = base64.urlsafe_b64encode(message.as_bytes()).decode()
        service.users().messages().send(userId="me", body={"raw": encoded}).execute()
        return f"Email sent to {to}"
