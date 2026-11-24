from enum import Enum
from typing import Optional, Dict, Any
from datetime import datetime

_SEVERITY_RANK = {"INFO": 0, "WARNING": 1, "ERROR": 2, "CRITICAL": 3}


class ErrorSeverity(Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

    @property
    def rank(self) -> int:
        return _SEVERITY_RANK[self.value]

    def __gt__(self, other: "ErrorSeverity") -> bool:
        return self.rank > other.rank

    def __lt__(self, other: "ErrorSeverity") -> bool:
        return self.rank < other.rank

    def __ge__(self, other: "ErrorSeverity") -> bool:
        return self.rank >= other.rank

    def __le__(self, other: "ErrorSeverity") -> bool:
        return self.rank <= other.rank


class RetryPolicy:
    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        strategy: str = "exponential",
        backoff_factor: float = None,
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.strategy = strategy
        # `backoff_factor` is accepted as an alias for `base_delay` for
        # backwards compatibility with callers that use that name.
        self.backoff_factor = backoff_factor if backoff_factor is not None else base_delay

    def get_delay(self, attempt: int) -> float:
        if self.strategy == "exponential":
            delay = min(self.backoff_factor * (2 ** attempt), self.max_delay)
        elif self.strategy == "linear":
            delay = min(self.backoff_factor * (attempt + 1), self.max_delay)
        else:
            delay = self.backoff_factor

        import random
        return delay + random.uniform(0, 0.1 * delay)

    def should_retry(self, attempt: int) -> bool:
        return attempt < self.max_retries


class AgentException(Exception):
    """Base exception for all agent errors.

    Accepts a human-readable message plus arbitrary keyword metadata
    (e.g. tool_name, provider, session_id); metadata is exposed both as
    instance attributes and in `to_dict()`.
    """

    def __init__(
        self,
        message: str,
        severity: ErrorSeverity = ErrorSeverity.ERROR,
        retry_policy: Optional[RetryPolicy] = None,
        context: Optional[Dict[str, Any]] = None,
        error_code: Optional[str] = None,
        **extra: Any,
    ):
        super().__init__(message)
        self.message = message
        self.severity = severity
        self.retry_policy = retry_policy
        self.context = context or {}
        self.error_code = error_code or self.__class__.__name__.upper()
        self.timestamp = datetime.now()
        self._extra = extra
        for key, value in extra.items():
            setattr(self, key, value)

    def __str__(self) -> str:
        return self.message

    def to_dict(self) -> dict:
        data = {
            "message": self.message,
            "error_type": self.__class__.__name__,
            "error_code": self.error_code,
            "severity": self.severity.value,
            "context": self.context,
            "timestamp": self.timestamp.isoformat(),
        }
        data.update(self._extra)
        return data


class AgentError(AgentException):
    pass


class ConfigurationError(AgentException):
    pass


class MissingConfigError(ConfigurationError):
    def __init__(self, config_key: str, **kwargs):
        kwargs.setdefault("severity", ErrorSeverity.CRITICAL)
        kwargs.setdefault("config_key", config_key)
        super().__init__(f"Missing required configuration: {config_key}", **kwargs)


class InvalidConfigError(ConfigurationError):
    def __init__(self, config_key: str, reason: str, **kwargs):
        kwargs.setdefault("config_key", config_key)
        kwargs.setdefault("reason", reason)
        super().__init__(f"Invalid configuration for {config_key}: {reason}", **kwargs)


class ToolError(AgentException):
    pass


class ToolNotFoundError(ToolError):
    def __init__(self, tool_name: str, **kwargs):
        kwargs.setdefault("tool_name", tool_name)
        super().__init__(f"Tool not found: {tool_name}", **kwargs)


class ToolExecutionError(ToolError):
    def __init__(self, message: str, tool_name: str = None, retry_policy: Optional[RetryPolicy] = None, **kwargs):
        super().__init__(message, tool_name=tool_name, retry_policy=retry_policy, **kwargs)


class ToolTimeoutError(ToolError):
    def __init__(self, message: str, tool_name: str = None, timeout_seconds: float = None, **kwargs):
        kwargs.setdefault("severity", ErrorSeverity.WARNING)
        kwargs.setdefault("retry_policy", RetryPolicy(max_retries=2, base_delay=2.0))
        super().__init__(message, tool_name=tool_name, timeout_seconds=timeout_seconds, **kwargs)


class ToolAuthenticationError(ToolError):
    def __init__(self, message: str, tool_name: str = None, required_credentials: list = None, **kwargs):
        kwargs.setdefault("severity", ErrorSeverity.CRITICAL)
        super().__init__(
            message,
            tool_name=tool_name,
            required_credentials=required_credentials or [],
            **kwargs,
        )


class ToolRateLimitError(ToolError):
    def __init__(self, message: str, tool_name: str = None, retry_after: int = None, **kwargs):
        kwargs.setdefault("severity", ErrorSeverity.WARNING)
        kwargs.setdefault("retry_policy", RetryPolicy(max_retries=5, base_delay=retry_after or 60))
        super().__init__(message, tool_name=tool_name, retry_after=retry_after, **kwargs)


class LLMError(AgentException):
    def __init__(self, message: str, provider: str = None, **kwargs):
        super().__init__(message, provider=provider, **kwargs)


class LLMConnectionError(LLMError):
    def __init__(self, message: str = "Failed to connect to LLM provider", **kwargs):
        kwargs.setdefault("retry_policy", RetryPolicy(max_retries=5, base_delay=2.0))
        super().__init__(message, **kwargs)


class LLMAuthenticationError(LLMError):
    def __init__(self, message: str = "Authentication failed. Check API keys.", **kwargs):
        kwargs.setdefault("severity", ErrorSeverity.CRITICAL)
        super().__init__(message, **kwargs)


class LLMRateLimitError(LLMError):
    def __init__(self, message: str = "Rate limit exceeded", retry_after: int = None, **kwargs):
        kwargs.setdefault("severity", ErrorSeverity.WARNING)
        kwargs.setdefault("retry_policy", RetryPolicy(max_retries=5, base_delay=retry_after or 60))
        super().__init__(message, retry_after=retry_after, **kwargs)


class LLMContextLengthError(LLMError):
    def __init__(self, message: str, context_length: int = None, max_length: int = None, **kwargs):
        super().__init__(message, context_length=context_length, max_length=max_length, **kwargs)


class MCPError(AgentException):
    pass


class MCPConnectionError(MCPError):
    def __init__(self, message: str = "Failed to connect to MCP server", **kwargs):
        kwargs.setdefault("retry_policy", RetryPolicy(max_retries=3))
        super().__init__(message, **kwargs)


class MCPTimeoutError(MCPError):
    def __init__(self, message: str, timeout_seconds: float = None, **kwargs):
        kwargs.setdefault("severity", ErrorSeverity.WARNING)
        kwargs.setdefault("retry_policy", RetryPolicy(max_retries=2))
        super().__init__(message, timeout_seconds=timeout_seconds, **kwargs)


class MemoryError(AgentException):
    pass


class MemoryStorageError(MemoryError):
    def __init__(self, reason: str, **kwargs):
        super().__init__(f"Failed to store memory: {reason}", reason=reason, **kwargs)


class MemoryRetrievalError(MemoryError):
    def __init__(self, reason: str, **kwargs):
        super().__init__(f"Failed to retrieve memory: {reason}", reason=reason, **kwargs)


class PlanningError(AgentException):
    def __init__(self, message: str = "Failed to create execution plan", **kwargs):
        super().__init__(message, **kwargs)


class PlanGenerationError(PlanningError):
    pass


class PlanExecutionError(PlanningError):
    def __init__(self, reason: str, step: int = None, **kwargs):
        message = f"Failed to execute plan: {reason}" + (f" at step {step}" if step else "")
        super().__init__(message, reason=reason, step=step, **kwargs)


class SessionError(AgentException):
    pass


class SessionNotFoundError(SessionError):
    def __init__(self, session_id: str, **kwargs):
        kwargs.setdefault("severity", ErrorSeverity.WARNING)
        super().__init__(f"Session not found: {session_id}", session_id=session_id, **kwargs)


class SessionExpiredError(SessionError):
    def __init__(self, message: str = None, session_id: str = None, ttl_minutes: int = None, **kwargs):
        kwargs.setdefault("severity", ErrorSeverity.WARNING)
        super().__init__(
            message or f"Session expired: {session_id}",
            session_id=session_id,
            ttl_minutes=ttl_minutes,
            **kwargs,
        )


class RecoveryError(AgentException):
    pass


class RecoveryFailedError(RecoveryError):
    def __init__(self, reason: str, max_attempts: int, **kwargs):
        super().__init__(
            f"Recovery failed after {max_attempts} attempts: {reason}",
            reason=reason,
            max_attempts=max_attempts,
            **kwargs,
        )


class UnrecoverableError(RecoveryError):
    def __init__(self, reason: str, **kwargs):
        kwargs.setdefault("severity", ErrorSeverity.CRITICAL)
        super().__init__(f"Unrecoverable error: {reason}", reason=reason, **kwargs)
