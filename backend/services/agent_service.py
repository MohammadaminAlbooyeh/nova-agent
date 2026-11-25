from agent.core.orchestrator import Orchestrator
from agent.workflows.research_workflow import ResearchWorkflow
from agent.workflows.analysis_workflow import AnalysisWorkflow
from agent.workflows.task_automation_workflow import TaskAutomationWorkflow
from backend.utils.logger import get_logger

logger = get_logger(__name__)


class AgentService:
    def __init__(self):
        self.orchestrator = Orchestrator()
        self._register_workflows(self.orchestrator)

    def _register_workflows(self, orchestrator):
        orchestrator.register_workflow(
            "research", ResearchWorkflow(orchestrator.agent)
        )
        orchestrator.register_workflow(
            "analysis", AnalysisWorkflow(orchestrator.agent)
        )
        orchestrator.register_workflow(
            "automation", TaskAutomationWorkflow(orchestrator.agent)
        )

    async def run_task(self, task: str, workflow: str = None, config: dict = None) -> str:
        logger.info(f"Agent service running task: {task}")
        if config:
            orchestrator = Orchestrator(config)
            self._register_workflows(orchestrator)
            # Reuse the long-lived MCP session from the app lifespan's
            # connected client: a fresh Orchestrator's MCPClient is never
            # connect()-ed, so without this its agent sees an empty tool
            # list and refuses any tool work. Share just the session, not
            # the whole client, so this request's own policy (forbidden
            # tools, allowed domains, ...) still applies to its calls.
            orchestrator.agent.mcp_client.session = self.orchestrator.agent.mcp_client.session
            return await orchestrator.run_task(task, workflow)
        return await self.orchestrator.run_task(task, workflow)

    async def get_tools(self) -> list:
        return await self.orchestrator.agent.get_available_tools()
