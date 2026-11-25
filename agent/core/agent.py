from agent.core.planner import Planner
from agent.core.executor import Executor
from agent.core.evaluator import Evaluator
from agent.core.session_manager import SessionManager
from agent.core.policy import AgentPolicy
from agent.memory.memory_manager import MemoryManager
from agent.reasoning.react_pattern import ReActPattern
from agent.mcp_client.client import MCPClient
from agent.llm.llm_factory import LLMFactory
from agent.utils.logger import get_logger
from typing import Optional
import json

logger = get_logger(__name__)


class Agent:
    def __init__(self, config: dict = None, session_id: str = None, session_manager: SessionManager = None):
        self.config = config or {}
        self.session_id = session_id
        self.session_manager = session_manager
        self.memory = MemoryManager()
        self.policy = AgentPolicy.from_config(self.config)
        self.planner = Planner(self)
        self.executor = Executor(self)
        self.evaluator = Evaluator(self)
        self.reasoning = ReActPattern(self)
        self.reasoning.max_iterations = self.policy.max_steps
        self.mcp_client = MCPClient(policy=self.policy)

        llm_config = self.config.get("llm", {"provider": "openai"})
        if isinstance(llm_config, str):
            llm_config = {"provider": llm_config}
        self._llm_config = llm_config
        self._llm = None
        self.history = []

    @property
    def llm(self):
        # Constructed lazily: instantiating an Agent just to list tools or
        # inspect its config shouldn't require an LLM API key to be set.
        if self._llm is None:
            self._llm = LLMFactory.create(self._llm_config.get("provider", "openai"), self._llm_config)
        return self._llm

    async def run(self, task: str) -> str:
        logger.info(f"Agent received task: {task}" + (f" (session: {self.session_id})" if self.session_id else ""))

        self.memory.short_term.store("current_task", task)
        plan = await self.planner.create_plan(task)
        self.memory.short_term.store("plan", plan)

        if self.planner.is_direct_answer(plan, task):
            # Simple conversation: skip the ReAct loop entirely and answer
            # the user's message directly, with recent history as context.
            result = await self._direct_answer(task)
        else:
            result = await self.executor.execute_plan(plan, original_task=task)

        evaluation = await self.evaluator.evaluate(task, result)
        self.history.append({"task": task, "plan": plan, "result": result, "evaluation": evaluation})
        await self.memory.store(task, result, memory_type="long_term")

        await self._save_session_state()
        return result

    async def _direct_answer(self, task: str) -> str:
        history_lines = []
        for h in self.history[-5:]:
            history_lines.append(f"User: {h['task']}\nAssistant: {h['result']}")
        history_block = (
            "Previous conversation:\n" + "\n\n".join(history_lines) + "\n\n"
        ) if history_lines else ""
        prompt = (
            f"{history_block}"
            f"User message: {task}\n\n"
            "Respond directly and concisely to the user's message. "
            "Answer the question itself; do not describe steps or plans."
        )
        return await self.llm.generate(prompt)

    async def restore_from_session(self) -> bool:
        if not self.session_id or not self.session_manager:
            return False

        try:
            session = await self.session_manager.get_session(self.session_id)
            if not session:
                logger.warning(f"Session not found: {self.session_id}")
                return False

            memory_snapshot = session.get("memory_snapshot", {})
            if memory_snapshot:
                self.memory.short_term._storage = memory_snapshot.get("short_term", {})
                self.memory.long_term._storage = memory_snapshot.get("long_term", {})
                logger.info(f"Restored session state from {self.session_id}")
                return True
        except Exception as e:
            logger.error(f"Failed to restore session {self.session_id}: {e}")
            return False

        return False

    async def _save_session_state(self):
        if not self.session_id or not self.session_manager:
            return

        try:
            memory_snapshot = {
                "short_term": self.memory.short_term._storage if hasattr(self.memory.short_term, '_storage') else {},
                "long_term": self.memory.long_term._storage if hasattr(self.memory.long_term, '_storage') else {},
                "history_length": len(self.history),
            }

            await self.session_manager.save_memory_snapshot(self.session_id, memory_snapshot)
            await self.session_manager.increment_step_count(self.session_id)
            logger.debug(f"Saved session state for {self.session_id}")
        except Exception as e:
            logger.error(f"Failed to save session state: {e}")

    async def get_available_tools(self) -> list:
        return await self.mcp_client.list_tools()

    @classmethod
    async def create_with_session(cls, config: dict, session_manager: SessionManager, user_id: str = None):
        session_id = await session_manager.create_session(user_id=user_id)
        agent = cls(config=config, session_id=session_id, session_manager=session_manager)
        return agent, session_id

    @classmethod
    async def restore_with_session(cls, config: dict, session_id: str, session_manager: SessionManager):
        agent = cls(config=config, session_id=session_id, session_manager=session_manager)
        await agent.restore_from_session()
        return agent
