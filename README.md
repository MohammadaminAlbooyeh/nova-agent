# MCP Agent System

An AI Agent system built on the Model Context Protocol (MCP). This project demonstrates how to build a sophisticated multi-tool, multi-step reasoning agent capable of autonomously searching the web, interacting with databases, managing files, sending emails, executing code, and more — all through a unified MCP interface. See "⚠️ Known Security Limitations" below before treating this as production-ready for untrusted input.

## ✨ Key Features

### Core Capabilities
- **🔧 MCP Server** with 15+ specialized tools covering web, database, file, email, API, and code operations
- **🧠 Intelligent Reasoning Agent** with ReAct pattern for multi-step problem-solving
- **💾 Dual Memory System** with short-term context and long-term knowledge persistence
- **🔄 Chain-of-Thought Reasoning** with self-reflection and adaptive learning
- **🎯 Tool Orchestration** - seamless coordination of multiple tools in complex workflows

### Integration & Deployment
- **⚡ REST API** (FastAPI) for seamless external system integration
- **🎨 React Frontend** for real-time agent monitoring, control, and visualization
- **🤖 Multiple LLM Support** (OpenAI, Claude, Groq, local models)
- **🐳 Docker** containerization for consistent development and deployment
- **📊 Monitoring Stack** with Prometheus metrics and Grafana dashboards

### Quality & Reliability
- **✅ Comprehensive Testing** (unit, integration, load testing)
- **📈 Production-Ready** with error handling and graceful degradation
- **🔐 Session Management** with critical lifecycle bug fixes
- **📚 Extensive Documentation** and example workflows

### User-Supplied Configuration (Local Agent Mode)
- **🔑 User-Supplied API Keys** - enter your own OpenAI/Claude/Groq key in the frontend Settings page; the key is stored only in the browser's `localStorage` and sent per-request, never persisted on the server
- **📄 Document Upload** - upload `.txt`, `.md`, `.pdf`, or `.docx` files via `POST /api/documents/upload`; extracted text is stored in the agent's long-term memory as context
- **🛡️ Agent Policy/Constraints** - configurable `max_steps`, `forbidden_tools`, `forbidden_actions`, and `allowed_domains`, enforced in `agent/core/policy.py` and checked on every tool call (not just declared in config)
- **🪶 Lightweight Local Mode** - `docker-compose.local.yml` runs just the MCP server, backend, and frontend (SQLite + in-process memory, no Postgres/Redis/Prometheus/Grafana required); the full `docker-compose.yml` with the monitoring stack remains available for anyone who wants it

## ⚠️ Known Security Limitations

Despite the "production-ready" framing above, be aware of these gaps before exposing this to untrusted input:

- **`code_executor` is still not sandboxed, but its risk surface is reduced.** It runs `exec()` with process privileges (no OS-level isolation, no resource limits), but the builtins environment now excludes `open`, `exec`, `eval`, `compile`, `__import__`, `input`, and a few others — which also means ordinary `import` statements fail inside it. A `timeout` is now actually enforced (it previously was accepted but ignored); the runaway thread can't be force-killed and may keep running in the background after the timeout fires. It remains disabled by default via agent policy (`forbidden_tools`); only enable it if you understand the residual risk.
- **`database_tools` (`sql_executor`, `db_writer`, `db_reader`) use string-built SQL for table/column names** (values are still bound as parameters). Table/column names are now validated against a strict identifier pattern (`mcp_server/utils/validators.py:validate_identifier`), and raw query/WHERE-clause strings are rejected if they contain a schema-altering keyword (`DROP`, `TRUNCATE`, `ALTER`, `CREATE`, `GRANT`, `REVOKE`), a stacked statement (`;`), or a comment marker (`--`, `/*`). This meaningfully reduces injection risk but is still a filter, not a real SQL sandbox or parser.
- **`file_manager`/`file_reader`/`file_writer` support an opt-in workspace restriction.** Set `MCP_WORKSPACE_DIR` to a directory to confine these tools to it (path-containment via `mcp_server/utils/validators.py:validate_file_path`, not a full OS-level sandbox). Unset by default, matching prior behavior.
- The agent's plan-execution loop (`agent/core/executor.py` + `agent/reasoning/react_pattern.py`) now actually invokes MCP tools via the ReAct thought/action/observation loop; previously it only generated text without calling tools.

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Python 3.10+
- API keys for LLM providers (OpenAI, Claude, etc.)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd mcp_agent_system

# Setup environment
cp .env.example .env
# Edit .env with your API keys

# Start the system
docker-compose up
```

The system will be available at:
- **API**: http://localhost:8000
- **Frontend**: http://localhost:3000
- **Grafana**: http://localhost:3001 (credentials in docker-compose.yml)

## 🔗 System Connection Diagram

### Available Tools & Components

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Web Search   │  │  Database    │  │   Email      │          │
│  │ Tool         │  │   Tool       │  │   Tool       │          │
│  │ (Google)     │  │ (SQL Query)  │  │ (SMTP)       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  File Read   │  │ File Write   │  │   HTTP       │          │
│  │    Tool      │  │    Tool      │  │  API Tool    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Code Execute │  │ Web Scrape   │  │  Utilities   │          │
│  │  Tool        │  │    Tool      │  │   Tools      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│                         ▲         ▲                             │
│                         │         │                             │
│                    All coordinated by MCP Protocol              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### System Architecture Flow

```
┌────────────────────────────────────────────────────────────────┐
│                          USER INPUT                            │
│                    (Web/CLI/API Request)                       │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│                     REST API (FastAPI)                         │
│            ⚡ Validates & Routes Requests                      │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│                      AGENT CORE                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Planner     │  │  Executor    │  │  Reflector   │         │
│  │ (Task Plan)  │  │ (Run Tools)  │  │ (Evaluate)   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└──────────┬──────────────────────────────────────┬──────────────┘
           │                                      │
           ▼                                      ▼
┌────────────────────────┐          ┌────────────────────────┐
│   REASONING ENGINE     │          │    MEMORY SYSTEM       │
│ ┌────────────────────┐ │          │ ┌────────────────────┐ │
│ │  ReAct Loop        │ │          │ │  Short-Term (RAM)  │ │
│ │  Chain-of-Thought  │ │          │ │  Long-Term (DB)    │ │
│ │  Self-Reflection   │ │          │ │  Semantic Search   │ │
│ └────────────────────┘ │          │ └────────────────────┘ │
└────────────┬───────────┘          └────────────┬────────────┘
             │                                   │
             │        ┌─────────────────────────┘
             │        │
             ▼        ▼
┌────────────────────────────────────────────────────────────────┐
│                   MCP CLIENT & SERVER                          │
│         (Tool Discovery & Invocation Protocol)                 │
└──────────────────────────┬─────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
│  WEB TOOLS       │ │ DATABASE     │ │   FILE & EMAIL   │
│ ┌──────────────┐ │ │   TOOLS      │ │      TOOLS       │
│ │Search        │ │ │ ┌──────────┐ │ │ ┌──────────────┐ │
│ │Scrape        │ │ │ │Query     │ │ │ │Read/Write    │ │
│ │HTTP Request  │ │ │ │Insert    │ │ │ │Send Email    │ │
│ └──────────────┘ │ │ │Update    │ │ │ │Parse Files   │ │
└──────────────────┘ │ └──────────┘ │ │ └──────────────┘ │
                     └──────────────┘ └──────────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │   LLM PROVIDERS                  │
        │  ┌────────┐  ┌────────┐ ┌─────┐ │
        │  │OpenAI  │  │Claude  │ │Groq │ │
        │  └────────┘  └────────┘ └─────┘ │
        └──────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │   DATA STORAGE                   │
        │  ┌────────────────────────────┐  │
        │  │ PostgreSQL (Persistence)   │  │
        │  │ Redis (Cache)              │  │
        │  └────────────────────────────┘  │
        └──────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────┐
        │  MONITORING & VISUALIZATION      │
        │  ┌────────────────────────────┐  │
        │  │ Prometheus (Metrics)       │  │
        │  │ Grafana (Dashboards)       │  │
        │  └────────────────────────────┘  │
        └──────────────────────────────────┘
```

### Component Interaction Matrix

```
┌────────────────┬──────────┬───────────┬──────────┬───────────┐
│   Component    │  Agent   │  Reasoning│ Memory   │   Tools   │
├────────────────┼──────────┼───────────┼──────────┼───────────┤
│ Agent Core     │    -     │  Controls │ Updates  │ Invokes   │
│ Reasoning      │ Receives │     -     │ Queries  │ Decides   │
│ Memory System  │ Stores   │ Provides  │    -     │ Logs      │
│ MCP Tools      │ Reports  │ Analyzes  │ Records  │    -      │
│ LLM Provider   │ Assists  │ Guides    │ Context  │ Evaluates │
│ API/Frontend   │ Status   │ Metrics   │ Insights │ Display   │
└────────────────┴──────────┴───────────┴──────────┴───────────┘
```

## 📁 Project Architecture

```
mcp_agent_system/
├── mcp_server/          # MCP Protocol Server (15+ tools)
│   ├── tools/           # Web, database, file, email, code tools
│   ├── handlers/        # Tool request handlers
│   ├── resources/       # MCP resource definitions
│   └── prompts/         # System prompts and instructions
│
├── agent/               # AI Agent Core Engine
│   ├── core/            # Agent orchestration and lifecycle
│   ├── reasoning/       # ReAct reasoning loop, self-reflection
│   ├── memory/          # Short-term and long-term memory
│   ├── llm/             # LLM integrations (OpenAI, Claude, Groq)
│   ├── mcp_client/      # MCP protocol client
│   └── workflows/       # Predefined task workflows
│
├── backend/             # REST API Layer (FastAPI)
│   ├── api/             # API endpoints and routes
│   ├── services/        # Business logic
│   ├── models/          # Pydantic data models
│   └── utils/           # Helper utilities
│
├── frontend/            # React Dashboard
│   ├── src/             # React components and pages
│   └── public/          # Static assets
│
├── config/              # Configuration Management
│   └── settings.yaml    # System configuration
│
├── tests/               # Test Suites
│   ├── unit/            # Unit tests
│   ├── integration/      # Integration tests
│   └── load/            # Load testing
│
├── monitoring/          # Observability
│   └── grafana_dashboards/  # Dashboard definitions
│
├── examples/            # Usage Examples
│   ├── basic/           # Simple agent usage
│   ├── advanced/        # Complex workflows
│   └── workflows/       # Predefined task workflows
│
├── docs/                # Documentation
│   ├── QUICKSTART.md
│   ├── ARCHITECTURE.md
│   ├── API_REFERENCE.md
│   └── DEPLOYMENT.md
│
├── notebooks/           # Jupyter Notebooks
└── scripts/             # Utility Scripts
```

## 🧰 Tools & Capabilities Overview

```
TOOL CATEGORIES & CONNECTIONS
═══════════════════════════════════════════════════════════

🌐 WEB TOOLS                          📊 DATA TOOLS
├── Search Web                         ├── Query Database
├── Scrape Website                     ├── Insert Data
├── HTTP Requests                      ├── Update Records
└── Parse HTML/JSON                    └── Delete Data
         │                                    │
         ├────────────────┬────────────────────┤
         │                │                    │
         ▼                ▼                    ▼
    ┌─────────────────────────────────────┐
    │   AGENT REASONING ENGINE            │
    │   (Decides which tool to use)       │
    └─────────────────────────────────────┘
         │                │                    │
         ├────────────────┼────────────────────┤
         │                │                    │
         ▼                ▼                    ▼
📁 FILE TOOLS              ✉️  EMAIL TOOLS       💻 CODE TOOLS
├── Read File              ├── Send Email       ├── Execute Code
├── Write File             ├── Parse Email      ├── Lint Code
├── Delete File            └── Attach Files     └── Debug
└── Directory List                              
         │
         └────────────────┬────────────────────┘
                          │
                    ┌─────▼──────┐
                    │ RESULTS    │
                    │ LOGGED     │
                    └────────────┘
```

### Tool Connection Example

```
SAMPLE WORKFLOW: "Search for Python best practices and send report"
════════════════════════════════════════════════════════════════

Step 1: Agent receives task
        │
        ▼
Step 2: Use Web Search Tool
        ├─→ Search: "Python best practices"
        └─→ Returns: [results with URLs]
        │
        ▼
Step 3: Use Web Scrape Tool
        ├─→ Scrape URLs from Step 2
        └─→ Returns: [content]
        │
        ▼
Step 4: Agent analyzes with LLM
        ├─→ Reason about results
        └─→ Decide: need to send report
        │
        ▼
Step 5: Use File Write Tool
        ├─→ Create report file
        └─→ Returns: [file path]
        │
        ▼
Step 6: Use Email Tool
        ├─→ Send file to recipient
        └─→ Returns: [success status]
        │
        ▼
COMPLETE ✓
```

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **AI/Reasoning** | OpenAI API, Claude, Groq, LangChain |
| **MCP Protocol** | Python MCP SDK |
| **Backend API** | FastAPI, Python 3.10+ |
| **Frontend** | React, TypeScript, Axios |
| **Database** | PostgreSQL (primary), Redis (cache) |
| **Testing** | Pytest, pytest-asyncio |
| **Containerization** | Docker, Docker Compose |
| **Monitoring** | Prometheus, Grafana |

## 📖 Documentation

Complete documentation is available in the `docs/` directory:

- **[Quick Start Guide](docs/QUICKSTART.md)** - Get up and running in 5 minutes
- **[Architecture Overview](docs/ARCHITECTURE.md)** - System design and component interactions
- **[MCP Protocol Guide](docs/MCP_GUIDE.md)** - Understanding the Model Context Protocol
- **[Tools Reference](docs/TOOLS_GUIDE.md)** - Available tools and their usage
- **[API Reference](docs/API_REFERENCE.md)** - REST API endpoints and schemas
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment strategies
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

## 🎯 Usage Examples

### Basic Agent Interaction

```python
from agent.core import Agent
from config.settings import load_config

# Initialize agent
config = load_config()
agent = Agent(config)

# Execute a task
result = agent.run(
    task="Search for Python best practices and summarize the top 5",
    max_steps=10
)

print(result.output)
```

### Advanced Multi-step Workflow

```python
# See examples/ directory for complex workflows including:
# - Web research and report generation
# - Database queries with analysis
# - File processing pipelines
# - Email notifications with attachments
```

See the `examples/` directory for more detailed workflows.

## 🧪 Testing

```bash
# Run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=agent --cov=backend --cov=mcp_server

# Run specific test suite
pytest tests/unit/           # Unit tests
pytest tests/integration/    # Integration tests
pytest tests/load/           # Load testing
```

## 🚢 Deployment

### Docker Compose (Development)
```bash
docker-compose up
```

### Production Deployment
See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for:
- Kubernetes configuration
- Environment variable setup
- Database migrations
- Scaling strategies
- Monitoring setup

## 🔧 Configuration

The system is configured via:
- **Environment variables** (.env file)
- **YAML configuration** (config/settings.yaml)
- **Docker Compose** (docker-compose.yml)

See [docs/SERVER_GUIDE.md](docs/SERVER_GUIDE.md) for detailed configuration options.

### Database migrations

A brand-new database (including the default local SQLite file and the test
suite) is created directly from the current models via `init_db()` — no
migration needed. If you have an **existing** database you want to upgrade
in place instead of recreating, use Alembic:

```bash
alembic upgrade head          # apply all pending migrations
alembic revision --autogenerate -m "describe the change"   # after editing a model
```

## 📊 Monitoring & Observability

- **Prometheus Metrics** - Agent performance, API latency, tool execution times
- **Grafana Dashboards** - Real-time visualization of system health
- **Structured Logging** - Detailed logs for debugging and audit trails

Access Grafana at http://localhost:3001 after running `docker-compose up`.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) file for details.

## 🆘 Support & Troubleshooting

- **Issues**: Check [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- **Questions**: See documentation in `docs/` directory
- **Bugs**: Open an issue on GitHub

## 📚 Learn More

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [React Documentation](https://react.dev)
- [OpenAI API Reference](https://platform.openai.com/docs)

---

**Built with ❤️ | Production-Ready | Fully Documented | MIT Licensed**
