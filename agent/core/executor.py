from agent.utils.logger import get_logger

logger = get_logger(__name__)


class Executor:
    def __init__(self, agent):
        self.agent = agent

    async def execute_plan(self, plan: list[dict], original_task: str | None = None) -> str:
        max_steps = getattr(self.agent.policy, "max_steps", None)
        if max_steps is not None and len(plan) > max_steps:
            logger.warning(
                f"Plan has {len(plan)} steps, truncating to policy max_steps={max_steps}"
            )
            plan = plan[:max_steps]

        logger.info(f"Executing plan with {len(plan)} steps")
        results = []
        for step in plan:
            result = await self._execute_step(step, original_task=original_task)
            description = step.get('description') if isinstance(step, dict) else str(step)
            results.append((description, result))

        # A single-step plan (the common case for a simple chat message) is
        # just that step's answer; the "Step/Result" framing only earns its
        # keep when there's more than one step to tell apart.
        if len(results) == 1:
            return results[0][1]
        return "\n\n".join(f"Step: {description}\nResult: {result}" for description, result in results)

    async def execute_tool(self, tool_name: str, params: dict = None) -> str:
        logger.info(f"Executing tool: {tool_name}")
        return await self.agent.mcp_client.call_tool(tool_name, params or {})

    async def _execute_step(self, step, original_task: str | None = None) -> str:
        if isinstance(step, str):
            step = {"description": step}
        if isinstance(step, dict):
            step["status"] = "in_progress"
        try:
            description = step.get("description") if isinstance(step, dict) else step
            # Thread the user's original message through to the reasoning
            # loop: a bare step description like "1. Directly answer the
            # user's message." is meaningless on its own, and the LLM will
            # hallucinate an answer if it never sees what the user asked.
            result = await self.agent.reasoning.run(description, original_task=original_task)
            if isinstance(step, dict):
                step["status"] = "completed"
            return result
        except Exception as e:
            if isinstance(step, dict):
                step["status"] = "failed"
            return f"Error: {e}"
