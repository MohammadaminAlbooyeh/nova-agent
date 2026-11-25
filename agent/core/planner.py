import re

from agent.utils.logger import get_logger

logger = get_logger(__name__)

# Matches a numbered ("1.", "1)"), bulleted ("-", "*") or bolded-step
# ("**Step 1" / "Step 1:") line, each optionally preceded by markdown
# bold markers. This has to be permissive: smaller/faster models (e.g.
# Groq's) are inconsistent about exactly which of these they use.
_STEP_LINE = re.compile(r"^\*{0,2}(?:\d+[.)]|[-*]|step\s*\d+[:.]?)", re.IGNORECASE)

# The literal single-step plan the planner prompt asks for when the task
# is simple conversation and needs no tools.
_DIRECT_ANSWER = re.compile(r"directly answer the user'?s message", re.IGNORECASE)

# Tasks that clearly need a tool, regardless of what the planner LLM
# claims: URLs, and verbs/nouns that map 1:1 onto a tool category.
# Smaller models routinely misclassify these as "simple conversation",
# which sends them down the no-tools direct-answer path.
_NEEDS_TOOLS = re.compile(
    r"https?://|\b(search|google|fetch|scrape|crawl|download|browse|"
    r"look up|latest|current|today|news|weather|"
    r"file|folder|directory|save|write to|read from|"
    r"database|db|sql|query|table|"
    r"email|send|inbox|"
    r"run|execute|code|script)\b",
    re.IGNORECASE,
)


class Planner:
    def __init__(self, agent):
        self.agent = agent

    async def create_plan(self, task: str) -> list[dict]:
        logger.info(f"Creating plan for: {task}")
        tools = await self.agent.get_available_tools()
        prompt = (
            f"Task: {task}\n\n"
            f"Available tools: {[t.name for t in tools]}\n\n"
            "Decide how to handle this task.\n\n"
            "ONLY if the task is pure conversation — a greeting, small talk, "
            "or a general-knowledge question that needs no fresh data and no "
            "tool — respond with exactly one line:\n"
            "1. Directly answer the user's message.\n\n"
            "In EVERY other case — anything involving a URL, searching the "
            "web, current/latest information, files, databases, email, or "
            "running code — you MUST break the task into the minimum number "
            "of concrete steps that use the available tools, one per line, "
            "numbered like:\n"
            "1. <first step, naming the tool to use>\n"
            "2. <second step>\n"
            "Do not add explanations before or after the numbered list."
        )
        response = await self.agent.llm.generate(prompt)
        plan = self._parse_plan(response)
        return plan

    def is_direct_answer(self, plan: list[dict], task: str = "") -> bool:
        """True when the plan is the single literal 'directly answer' step.

        Guarded by a keyword check on the task itself: if the user's message
        plainly calls for a tool (a URL, 'search', 'file', ...), we never
        take the no-tools direct-answer path, even when the planner LLM
        misclassified it.
        """
        if len(plan) != 1:
            return False
        description = plan[0].get("description", "")
        if not _DIRECT_ANSWER.search(description):
            return False
        if task and _NEEDS_TOOLS.search(task):
            logger.info("Planner said direct-answer but task mentions tool work; running full loop instead")
            # Rewrite the misclassified plan into a real instruction so the
            # ReAct loop works on the actual task, not the literal line.
            plan[0]["description"] = f"Complete the user's request using the available tools: {task}"
            return False
        return True

    def _parse_plan(self, response: str) -> list[dict]:
        steps = []
        for line in response.strip().split("\n"):
            line = line.strip()
            if line and _STEP_LINE.match(line):
                steps.append({"description": line, "status": "pending"})
        return steps if steps else [{"description": response, "status": "pending"}]
