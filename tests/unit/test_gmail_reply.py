import base64
import pytest

from backend.services.gmail_filter_repository import DEFAULT_FILTERS
from mcp_server.tools.email_tools import gmail_common as common
from mcp_server.tools.email_tools.gmail_reply import GmailReplyTool
from mcp_server.tools.email_tools.gmail_reply_candidates import GmailReplyCandidatesTool

ME = "me@example.com"


def make_message(mid="m1", sender="Alice <alice@corp.com>", subject="Hello", labels=("UNREAD", "INBOX"),
                 extra_headers=None, body="Can we meet tomorrow?"):
    headers = [{"name": "From", "value": sender}, {"name": "Subject", "value": subject},
               {"name": "Date", "value": "Mon, 1 Jan 2026"}, {"name": "Message-ID", "value": f"<{mid}@corp>"}]
    for k, v in (extra_headers or {}).items():
        headers.append({"name": k, "value": v})
    data = base64.urlsafe_b64encode(body.encode()).decode()
    return {"id": mid, "threadId": f"t-{mid}", "labelIds": list(labels),
            "payload": {"headers": headers, "mimeType": "text/plain", "body": {"data": data}}}


class _Exec:
    def __init__(self, value, log=None, name=None):
        self.value, self.log, self.name = value, log, name

    def execute(self):
        if self.log is not None:
            self.log.append(self.name)
        return self.value


class FakeService:
    """Just enough of the Gmail API surface used by the reply tools."""

    def __init__(self, messages, last_sender=None):
        self.store = {m["id"]: m for m in messages}
        self.last_sender = last_sender or {}
        self.sent, self.created, self.queries = [], [], []

    def users(self):
        return self

    def getProfile(self, userId):
        return _Exec({"emailAddress": ME})

    def messages_api(self):
        return self

    # users().messages()
    def messages(self):
        svc = self

        class M:
            def list(self, userId, q, maxResults):
                svc.queries.append(q)
                return _Exec({"messages": [{"id": i} for i in svc.store]})

            def get(self, userId, id, format):
                return _Exec(svc.store[id])

            def send(self, userId, body):
                svc.sent.append(body)
                return _Exec({})

        return M()

    def threads(self):
        svc = self

        class T:
            def get(self, userId, id, format, metadataHeaders):
                mid = id[2:]
                sender = svc.last_sender.get(mid, "alice@corp.com")
                return _Exec({"messages": [{"payload": {"headers": [{"name": "From", "value": sender}]}}]})

        return T()

    def drafts(self):
        svc = self

        class D:
            def create(self, userId, body):
                svc.created.append(body)
                return _Exec({})

        return D()


@pytest.fixture
def setup(monkeypatch, tmp_path):
    monkeypatch.setattr(common, "DATA_DIR", str(tmp_path))

    def install(messages, filters=None, last_sender=None):
        service = FakeService(messages, last_sender)
        merged = {**DEFAULT_FILTERS, "reply_enabled": True, **(filters or {})}

        async def fake_build(_sid):
            return service

        monkeypatch.setattr(common, "build_service", fake_build)
        monkeypatch.setattr(common, "load_filters", lambda _sid: merged)
        return service

    return install


# ---------- pure rules ----------

def rules(**overrides):
    return {**DEFAULT_FILTERS, **overrides}


def reason(headers=None, labels=("UNREAD",), last_me=False, **f):
    base = {"From": "bob@corp.com", "Subject": "Hi"}
    return common.reply_skip_reason({**base, **(headers or {})}, list(labels), last_me, rules(**f))


def test_plain_unread_email_is_allowed():
    assert reason() is None


def test_ignore_terms_block_reply():
    assert "ignore" in reason(headers={"From": "noreply@corp.com"})


def test_ignore_rule_can_be_unticked():
    assert reason(headers={"From": "noreply@corp.com"}, reply_skip_ignored=False) is None


def test_automated_mail_blocked_by_list_headers_and_auto_submitted():
    assert reason(headers={"List-Unsubscribe": "<x>"}) is not None
    assert reason(headers={"Precedence": "bulk"}) is not None
    assert reason(headers={"Auto-Submitted": "auto-replied"}) is not None
    assert reason(headers={"Auto-Submitted": "no"}) is None


def test_only_unread():
    assert "read" in reason(labels=("INBOX",))
    assert reason(labels=("INBOX",), reply_only_unread=False) is None


def test_only_important_needs_matching_term():
    assert reason(reply_only_important=True) is not None
    assert reason(headers={"Subject": "URGENT invoice"}, reply_only_important=True) is None


def test_allowed_senders_allowlist():
    assert reason(reply_allowed_senders=["boss@corp.com"]) is not None
    assert reason(reply_allowed_senders=["BOB@corp.com"]) is None


def test_already_replied_thread():
    assert reason(last_me=True) is not None
    assert reason(last_me=True, reply_skip_already_replied=False) is None


# ---------- extract_body ----------

def test_extract_body_prefers_plain_and_truncates():
    msg = make_message(body="x" * 5000)
    out = common.extract_body(msg)
    assert out.startswith("xxx") and out.endswith("[truncated]")


# ---------- tools ----------

@pytest.mark.asyncio
async def test_candidates_refuses_when_disabled(setup):
    setup([make_message()], filters={"reply_enabled": False})
    out = await GmailReplyCandidatesTool().execute(session_id="s")
    assert "turned off" in out


@pytest.mark.asyncio
async def test_candidates_lists_only_eligible_and_reports_skips(setup):
    svc = setup([make_message("a"), make_message("b", sender="noreply@x.com"),
                 make_message("c", labels=("INBOX",))])
    out = await GmailReplyCandidatesTool().execute(session_id="s")
    assert "message_id: a" in out
    assert "message_id: b" not in out and "message_id: c" not in out
    assert "ignore term" in out and "already read" in out
    assert "is:unread" in svc.queries[0] and '-"noreply"' in svc.queries[0]


@pytest.mark.asyncio
async def test_candidates_respects_max_per_run_and_handled(setup):
    setup([make_message(str(i)) for i in range(5)], filters={"reply_max_per_run": 2})
    common.mark_handled("s", "0")
    out = await GmailReplyCandidatesTool().execute(session_id="s")
    assert out.count("message_id:") == 2
    assert "message_id: 0" not in out


@pytest.mark.asyncio
async def test_reply_defaults_to_draft_and_is_threaded(setup):
    svc = setup([make_message("a")])
    out = await GmailReplyTool().execute(message_id="a", body="Sure, 10am works.", session_id="s")
    assert "draft" in out and not svc.sent
    payload = svc.created[0]["message"]
    assert payload["threadId"] == "t-a"
    raw = base64.urlsafe_b64decode(payload["raw"]).decode()
    assert "In-Reply-To: <a@corp>" in raw and "Subject: Re: Hello" in raw and "alice@corp.com" in raw


@pytest.mark.asyncio
async def test_reply_sends_only_in_send_mode(setup):
    svc = setup([make_message("a")], filters={"reply_mode": "send"})
    out = await GmailReplyTool().execute(message_id="a", body="Thanks!", session_id="s")
    assert "sent" in out.lower() and len(svc.sent) == 1 and not svc.created


@pytest.mark.asyncio
async def test_reply_blocked_for_excluded_message_even_if_model_asks(setup):
    svc = setup([make_message("a", sender="noreply@x.com")])
    out = await GmailReplyTool().execute(message_id="a", body="hi", session_id="s")
    assert "Not replying" in out and not svc.sent and not svc.created


@pytest.mark.asyncio
async def test_reply_not_repeated_for_same_message(setup):
    svc = setup([make_message("a")])
    await GmailReplyTool().execute(message_id="a", body="one", session_id="s")
    out = await GmailReplyTool().execute(message_id="a", body="two", session_id="s")
    assert "already handled" in out and len(svc.created) == 1


@pytest.mark.asyncio
async def test_reply_refuses_when_disabled_or_empty(setup):
    setup([make_message("a")], filters={"reply_enabled": False})
    assert "turned off" in await GmailReplyTool().execute(message_id="a", body="x", session_id="s")
    setup([make_message("a")])
    assert "empty" in await GmailReplyTool().execute(message_id="a", body="  ", session_id="s")
