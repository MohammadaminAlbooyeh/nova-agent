from urllib.parse import urlparse

from agent.utils.logger import get_logger

logger = get_logger(__name__)


class PolicyViolation(Exception):
    pass


class AgentPolicy:
    """Runtime constraints enforced on an Agent's plan execution and tool calls."""

    def __init__(self, config: dict = None):
        config = config or {}
        self.max_steps: int = config.get("max_steps", 20)
        default_forbidden_tools = ["code_executor", "sql_executor", "db_writer", "file_manager"]
        self.forbidden_tools: set[str] = set(
            config.get("forbidden_tools", default_forbidden_tools)
        )
        default_forbidden_actions = {"file_manager": {"delete"}}
        self.forbidden_actions: dict[str, set[str]] = {
            tool: set(actions)
            for tool, actions in (
                config.get("forbidden_actions") or default_forbidden_actions
            ).items()
        }
        self.allowed_domains: list[str] | None = config.get("allowed_domains")

    def check_tool_call(self, tool_name: str, arguments: dict) -> None:
        arguments = arguments or {}

        if tool_name in self.forbidden_tools:
            raise PolicyViolation(f"Tool '{tool_name}' is forbidden by policy")

        forbidden_actions = self.forbidden_actions.get(tool_name)
        if forbidden_actions:
            action = arguments.get("action")
            if action in forbidden_actions:
                raise PolicyViolation(
                    f"Action '{action}' on tool '{tool_name}' is forbidden by policy"
                )

        if self.allowed_domains is not None:
            url = arguments.get("url")
            if url:
                domain = urlparse(url).netloc
                if not any(
                    domain == allowed or domain.endswith(f".{allowed}")
                    for allowed in self.allowed_domains
                ):
                    raise PolicyViolation(
                        f"Domain '{domain}' is not in the allowed domains list"
                    )

    @classmethod
    def from_config(cls, config: dict) -> "AgentPolicy":
        return cls((config or {}).get("policy", {}))
