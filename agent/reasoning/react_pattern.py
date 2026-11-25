from agent.utils.logger import get_logger

logger = get_logger(__name__)


class ReActPattern:
    def __init__(self, agent):
        self.agent = agent
        self.max_iterations = 10

    async def run(self, task: str, original_task: str | None = None) -> str:
        # The reasoning loop must always see the user's actual message.
        # `task` here is one plan step (e.g. "2. Scrape the top result"),
        # which is meaningless without the original request it came from.
        if original_task and original_task.strip() != task.strip():
            context = f"User message: {original_task}\nCurrent step: {task}"
        else:
            context = f"User message: {task}"

        tools_block = await self._tools_block()

        for i in range(self.max_iterations):
            thought = await self._think(context, tools_block)
            logger.info(f"ReAct iteration {i}: {thought[:500]!r}")
            if self._is_final(thought):
                return self._extract_final_answer(thought)
            action, params = self._parse_action(thought)
            if not action:
                logger.info("ReAct: no Action parsed, treating thought as final answer")
                return self._extract_final_answer(thought)
            observation = await self._act(action, params)
            context += f"\nThought: {thought}\nAction: {action}\nObservation: {observation}"
        return context

    async def _tools_block(self) -> str:
        # Without the tool list in the prompt, the model cannot know any
        # valid tool names, so it never emits an Action and no tool is
        # ever used.
        try:
            tools = await self.agent.get_available_tools()
        except Exception as e:
            logger.warning(f"Could not list tools for reasoning prompt: {e}")
            return "(no tools available)"
        if not tools:
            return "(no tools available)"
        lines = []
        for t in tools:
            description = getattr(t, "description", "") or ""
            lines.append(f"- {t.name}: {description}".rstrip(": "))
        return "\n".join(lines)

    async def _think(self, context: str, tools_block: str) -> str:
        prompt = (
            f"{context}\n\n"
            f"Available tools:\n{tools_block}\n\n"
            "What should I do next? Respond with EITHER:\n"
            "Thought: [your reasoning]\n"
            "Action: [tool_name — exactly one name from the list above]\n"
            "Action Input: [params as JSON]\n"
            "OR, if you already have enough information to respond to the "
            "user (this is the common case for a simple message):\n"
            "Final Answer: [your response to the user, nothing else]"
        )
        return await self.agent.llm.generate(prompt)

    def _is_final(self, thought: str) -> bool:
        return "Final Answer:" in thought

    def _extract_final_answer(self, thought: str) -> str:
        # The model sometimes prefaces "Final Answer:" with its own
        # step-by-step reasoning despite being asked for one or the other;
        # callers only want the actual answer, not that scratchpad.
        marker = "Final Answer:"
        idx = thought.rfind(marker)
        if idx == -1:
            return thought.strip()
        return thought[idx + len(marker):].strip()

    def _parse_action(self, thought: str) -> tuple[str, dict]:
        lines = thought.split("\n")
        action, params = None, {}
        for line in lines:
            if line.startswith("Action:"):
                action = line.split(":", 1)[1].strip()
            elif line.startswith("Action Input:"):
                import json
                try:
                    params = json.loads(line.split(":", 1)[1].strip())
                except json.JSONDecodeError:
                    params = {"input": line.split(":", 1)[1].strip()}
        return action, params

    async def _act(self, action: str, params: dict) -> str:
        try:
            return await self.agent.executor.execute_tool(action, params)
        except Exception as e:
            return f"Error: {e}"
