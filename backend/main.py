import asyncio
import os
import uvicorn
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from backend.api.routes import router
from backend.api.sessions import router as sessions_router
from backend.api.oauth_routes import router as oauth_router
from backend.api.middleware import setup_middleware
from backend.models.database import init_db
from backend.utils.config import AppConfig
from backend.utils.logger import get_logger

logger = get_logger(__name__)
config = AppConfig()


@asynccontextmanager
async def lifespan(application: FastAPI):
    logger.info("Initializing database ")
    init_db()

    try:
        from backend.utils.redis_client import get_redis_client
        get_redis_client().init(config.redis_url)
        logger.info("Redis initialised")
    except Exception as exc:
        logger.warning(f"Redis init failed: {exc}")

    # Connect the default agent's MCP client here, in the lifespan's own
    # long-lived task, not from inside a per-request handler: the
    # underlying stdio/anyio streams are tied to whichever task opened
    # them, and a request's task ends as soon as that request completes,
    # which would silently break the connection for later requests.
    # Skipped under pytest: tests construct many short-lived Agent
    # instances and spawning a real MCP subprocess for each is slow/flaky
    # (tests that want a connection mock MCPClient.connect themselves).
    mcp_connected = False
    if "PYTEST_CURRENT_TEST" not in os.environ:
        try:
            from backend.api.dependencies import get_agent_service
            agent_service = get_agent_service()
            await agent_service.orchestrator.agent.mcp_client.connect()
            mcp_connected = True
            logger.info("MCP client connected")
        except Exception as exc:
            logger.warning(f"MCP client failed to connect: {exc}")

    yield

    if mcp_connected:
        try:
            await agent_service.orchestrator.agent.mcp_client.close()
        except Exception as exc:
            logger.warning(f"MCP client failed to close cleanly: {exc}")

    _redis_client = None
    try:
        from backend.utils.redis_client import _redis_client as _r
        if _r and _r.client:
            _r.client.close()
            if _r._pool:
                _r._pool.disconnect()
    except Exception:
        pass


app = FastAPI(
    title="MCP Agent System API",
    description="REST API for the MCP Agent System",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_middleware(app)
app.include_router(router, prefix="/api")
app.include_router(sessions_router, prefix="/api")
app.include_router(oauth_router, prefix="/api")


@app.get("/metrics")
async def metrics():
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "mcp-agent-system"}


def main():
    uvicorn.run(
        "backend.main:app",
        host=config.host,
        port=config.port,
        reload=config.debug,
    )


if __name__ == "__main__":
    main()
