import os
from mcp_server.tools.base_tool import BaseTool
from mcp_server.utils.validators import validate_file_path


class FileWriterTool(BaseTool):
    def __init__(self):
        super().__init__()
        self.name = "file_writer"
        self.description = "Write content to files"
        self.input_schema = {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path"},
                "content": {"type": "string", "description": "Content to write"},
                "mode": {"type": "string", "enum": ["write", "append"], "description": "Write or append mode"},
            },
            "required": ["path", "content"],
        }

    async def execute(self, path: str, content: str, mode: str = "write") -> str:
        workspace_dir = os.getenv("MCP_WORKSPACE_DIR", os.getcwd())
        if not validate_file_path(path, base_dir=workspace_dir):
            return f"Rejected: path '{path}' is outside the allowed workspace directory"

        file_mode = "w" if mode == "write" else "a"
        with open(path, file_mode) as f:
            f.write(content)
        return f"Successfully wrote {len(content)} characters to {path}"
