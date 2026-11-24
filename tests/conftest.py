import os
import pytest
import pytest_asyncio
import asyncio
from backend.models.database import init_db


@pytest.fixture(autouse=True, scope="session")
def dummy_llm_api_keys():
    """Provide placeholder API keys so LLM clients can be constructed in
    tests without real credentials. Tests that need actual API responses
    still mock `agent.llm.generate` explicitly."""
    os.environ.setdefault("OPENAI_API_KEY", "test-openai-key")
    os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
    os.environ.setdefault("GROQ_API_KEY", "test-groq-key")


def pytest_configure(config):
    """Configure pytest."""
    config.addinivalue_line(
        "markers", "asyncio: mark test as asyncio"
    )


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True, scope="session")
def setup_database():
    """Initialize database for testing."""
    try:
        init_db()
    except Exception as e:
        print(f"Database initialization warning: {e}")


@pytest.fixture
def agent_config():
    """Default agent configuration for tests."""
    return {
        "llm": "openai",
        "max_steps": 10,
        "max_context_tokens": 4000,
    }


@pytest.fixture
def mock_tool_result():
    """Mock tool execution result."""
    return "Mock tool execution result"


@pytest.fixture
def sample_task():
    """Sample task for testing."""
    return "Test task description"


@pytest.fixture
def test_user_id():
    """Test user ID."""
    return "test_user@example.com"


@pytest.fixture
def test_session_metadata():
    """Test session metadata."""
    return {
        "workflow": "research",
        "priority": "high",
        "tags": ["testing", "async"]
    }


@pytest_asyncio.fixture
async def async_client():
    """Async test client for API testing."""
    from httpx import AsyncClient
    from backend.main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
