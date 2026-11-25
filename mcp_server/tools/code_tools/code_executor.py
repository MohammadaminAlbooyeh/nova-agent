import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
from mcp_server.tools.base_tool import BaseTool

# Builtins removed from the exec() environment inside the sandboxed
# subprocess because they allow filesystem access, process control, or
# escaping the restricted globals (e.g. via __import__ or exec/eval
# themselves).
_UNSAFE_BUILTINS = {
    "open", "exec", "eval", "compile", "__import__", "input",
    "breakpoint", "help", "exit", "quit", "memoryview",
}

# Resource limits applied to the sandbox subprocess (Unix only; some of
# these are unsupported on macOS and are skipped there - see
# _apply_resource_limits). cpu_seconds is enforced again at the
# subprocess.communicate(timeout=...) layer as a hard wall-clock backstop.
_MAX_CPU_SECONDS = 10
_MAX_MEMORY_BYTES = 256 * 1024 * 1024  # 256MB

_WRAPPER_SOURCE = """
import builtins, io, json, sys

_unsafe = set({unsafe!r})
_restricted_builtins = {{
    name: getattr(builtins, name) for name in dir(builtins) if name not in _unsafe
}}

code = sys.stdin.read()
stdout, stderr = io.StringIO(), io.StringIO()
real_stdout, real_stderr = sys.stdout, sys.stderr
sys.stdout, sys.stderr = stdout, stderr
try:
    exec(code, {{"__builtins__": _restricted_builtins}})
    output = stdout.getvalue()
    if stderr.getvalue():
        output += "\\nStderr:\\n" + stderr.getvalue()
    result = {{"ok": True, "output": output or "Code executed successfully (no output)"}}
except Exception as e:
    result = {{"ok": False, "output": "Error: " + str(e)}}
finally:
    sys.stdout, sys.stderr = real_stdout, real_stderr

print(json.dumps(result))
"""


def _apply_resource_limits():
    # Runs in the child process after fork(), before exec(). Only Unix
    # (os.setsid/resource) is supported - on other platforms this is
    # simply not called (see CodeExecutorTool.execute).
    os.setsid()
    import resource

    for limit, value in (
        (resource.RLIMIT_CPU, _MAX_CPU_SECONDS),
        (resource.RLIMIT_AS, _MAX_MEMORY_BYTES),
        (resource.RLIMIT_CORE, 0),
    ):
        try:
            resource.setrlimit(limit, (value, value))
        except (ValueError, OSError):
            pass  # not supported on this platform (e.g. RLIMIT_AS on macOS)

    try:
        resource.setrlimit(resource.RLIMIT_NPROC, (0, 0))  # block fork bombs
    except (ValueError, OSError):
        pass


class CodeExecutorTool(BaseTool):
    def __init__(self):
        super().__init__()
        self.name = "code_executor"
        self.description = (
            "Execute Python code in a separate, resource-limited subprocess "
            "with restricted builtins (no open/exec/eval/import). This "
            "contains the blast radius (separate memory space, CPU/memory "
            "limits, hard-killed on timeout) but is still not a real "
            "sandbox: there is no container/network isolation, and a "
            "sufficiently creative payload can still reach OS primitives "
            "via object introspection. Disabled by default via agent policy."
        )
        self.input_schema = {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Python code to execute"},
                "timeout": {"type": "integer", "description": "Execution timeout in seconds"},
            },
            "required": ["code"],
        }

    async def execute(self, code: str, timeout: int = 30) -> str:
        sandbox_dir = tempfile.mkdtemp(prefix="code_executor_")
        wrapper = _WRAPPER_SOURCE.format(unsafe=sorted(_UNSAFE_BUILTINS))
        env = {"PATH": "/usr/bin:/bin", "HOME": sandbox_dir}

        popen_kwargs = dict(
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            cwd=sandbox_dir,
            env=env,
        )
        if sys.platform != "win32":
            popen_kwargs["preexec_fn"] = _apply_resource_limits

        proc = subprocess.Popen(
            [sys.executable, "-I", "-S", "-c", wrapper],
            **popen_kwargs,
        )
        try:
            stdout, _ = proc.communicate(input=code, timeout=timeout)
        except subprocess.TimeoutExpired:
            if sys.platform != "win32":
                try:
                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                except ProcessLookupError:
                    pass
            else:
                proc.kill()
            proc.communicate()
            return f"Error: execution exceeded {timeout}s timeout"
        finally:
            shutil.rmtree(sandbox_dir, ignore_errors=True)

        if proc.returncode != 0 or not stdout:
            return f"Error: sandbox process exited with code {proc.returncode}"

        try:
            result = json.loads(stdout)
        except json.JSONDecodeError:
            return "Error: sandbox produced unparseable output"

        return result.get("output", "Error: sandbox produced no output")
