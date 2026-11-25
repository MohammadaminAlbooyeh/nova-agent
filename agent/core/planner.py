import re

from agent.utils.logger import get_logger

logger = get_logger(__name__)

# Matches a numbered ("1.", "1)"), bulleted ("-", "*") or bolded-step
# ("**Step 1" / "Step 1:") line, each optionally preceded by markdown
# bold markers. This has to be permissive: smaller/faster models (e.g.
# Groq's) are inconsistent about exactly which of these they use.
_STEP_LINE = re.compile(r"^\*{0,2}(?:\d+[.)]|[-*]|step\s*\d+[:.]?)", re.IGNORECASE)


class Planner:
    def __init__(self, agent):
        self.agent = agent

    async def create_plan(self, task: str) -> list[dict]:
        logger.info(f"Creating plan for: {task}")
        tools = await self.agent.get_available_tools()
        prompt = (
            f"Task: {task}\n\n"
            f"Available tools: {[t.name for t in tools]}\n\n"
            "If this task is simple conversation (a greeting, small talk, a "
            "question you can answer directly) and doesn't need any tool, "
            "respond with exactly one line:\n"
            "1. Directly answer the user's message.\n\n"
            "Otherwise, break the task into the minimum number of concrete "
            "steps needed, one per line, numbered like:\n"
            "1. <first step>\n"
            "2. <second step>\n"
            "Do not add explanations before or after the numbered list."
        )
        response = await self.agent.llm.generate(prompt)
        plan = self._parse_plan(response)
        return plan

    def _parse_plan(self, response: str) -> list[dict]:
        steps = []
        for line in response.strip().split("\n"):
            line = line.strip()
            if line and _STEP_LINE.match(line):
                steps.append({"description": line, "status": "pending"})
        return steps if steps else [{"description": response, "status": "pending"}]
