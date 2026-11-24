import builtins
import concurrent.futures
import io
import sys
from mcp_server.tools.base_tool import BaseTool

# Builtins that are removed from the exec() environment below because they
# allow filesystem access, process control, or escaping the restricted
# globals (e.g. via __import__ or exec/eval themselves). This reduces but
# does not eliminate the risk: this is NOT a real sandbox (no resource
# limits, no restriction on imported module attributes, etc).
_UNSAFE_BUILTINS = {
    "open", "exec", "eval", "compile", "__import__", "input",
    "breakpoint", "help", "exit", "quit", "memoryview",
}


class CodeExecutorTool(BaseTool):
    def __init__(self):
        super().__init__()
        self.name = "code_executor"
        self.description = (
            "Execute Python code. NOT sandboxed: runs with restricted builtins "
            "(no open/exec/eval/import) but still full process privileges. "
            "Disabled by default via agent policy."
        )
        self.input_schema = {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Python code to execute"},
                "timeout": {"type": "integer", "description": "Execution timeout in seconds"},
            },
            "required": ["code"],
        }

    def _restricted_builtins(self) -> dict:
        return {
            name: getattr(builtins, name)
            for name in dir(builtins)
            if name not in _UNSAFE_BUILTINS
        }

    def _run(self, code: str) -> str:
        stdout = io.StringIO()
        stderr = io.StringIO()
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = stdout
        sys.stderr = stderr
        try:
            exec_globals = {"__builtins__": self._restricted_builtins()}
            exec(code, exec_globals)
            output = stdout.getvalue()
            if stderr.getvalue():
                output += "\nStderr:\n" + stderr.getvalue()
            return output or "Code executed successfully (no output)"
        except Exception as e:
            return f"Error: {e}"
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr

    async def execute(self, code: str, timeout: int = 30) -> str:
        # Not a context manager: shutting down a ThreadPoolExecutor normally
        # waits for in-flight work to finish, which would defeat the point
        # of a timeout against runaway code (e.g. an infinite loop). The
        # thread is daemonized instead so it can't block process exit, but
        # it still can't be forcibly killed and may keep running in the
        # background consuming CPU after this returns.
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1, thread_name_prefix="code_executor")
        future = executor.submit(self._run, code)
        try:
            return future.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            return f"Error: execution exceeded {timeout}s timeout"
        finally:
            executor.shutdown(wait=False)
