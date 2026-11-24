# API Reference

All routes are mounted under the `/api` prefix (e.g. `POST /api/agents/run`).

## Endpoints

### POST /api/agents/run
Run an agent task.

Request:
```json
{
  "task": "Research quantum computing",
  "workflow": "research",
  "llm_provider": "claude",
  "api_key": "sk-ant-...",
  "model": "claude-opus-4-20250514",
  "policy": {
    "max_steps": 15,
    "forbidden_tools": ["code_executor"],
    "allowed_domains": ["wikipedia.org"]
  }
}
```

`llm_provider`, `api_key`, `model`, and `policy` are all optional. When omitted, the server falls back to
the persisted settings from `GET /api/settings` (and ultimately to `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/
`GROQ_API_KEY` environment variables for the key). The frontend's Settings page sends `api_key` on every
request from its own browser-local storage; the key is never persisted on the server. See
`agent/core/policy.py` for what `policy` fields are enforced (not just declared).

### POST /api/tasks
Create a new task.

### GET /api/tasks
List all tasks.

### GET /api/tasks/{id}
Get task details.

### GET /api/tools
List available MCP tools.

### POST /api/executions/execute
Execute a single named tool directly (outside of an agent run).

### GET /api/executions
List execution history.

### GET /api/settings
Get the current persisted settings (`llmProvider`, `maxSteps`, `theme`, `forbiddenTools`, `allowedDomains`).
Does **not** include any API key — keys are never persisted server-side.

### POST /api/settings
Update persisted settings. Same fields as `GET /api/settings` returns.

### POST /api/documents/upload
Upload a document (`multipart/form-data`, field name `file`) to feed into the agent's long-term memory as
context. Supported extensions: `.txt`, `.md`, `.pdf`, `.docx`.

Response:
```json
{
  "filename": "notes.pdf",
  "characters_extracted": 1234,
  "memory_key": "document:notes.pdf:<id>"
}
```

### GET /api/monitoring/metrics
Get system metrics.

### WebSocket /api/ws/agent
Streams agent run progress/events.

### WebSocket /api/ws/monitoring
Streams live monitoring metrics.

## Response Format

All endpoints return JSON with appropriate HTTP status codes.
