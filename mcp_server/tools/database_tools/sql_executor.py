from mcp_server.tools.base_tool import BaseTool
from mcp_server.utils.validators import validate_sql_query


class SQLExecutorTool(BaseTool):
    def __init__(self):
        super().__init__()
        self.name = "sql_executor"
        self.description = "Execute SQL queries on the database"
        self.input_schema = {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "SQL query to execute"},
                "params": {"type": "object", "description": "Query parameters"},
            },
            "required": ["query"],
        }

    async def execute(self, query: str, params: dict = None) -> str:
        if not validate_sql_query(query):
            return "Rejected: query contains a forbidden schema-altering keyword"

        from sqlalchemy import text
        from backend.models.database import get_session
        session = get_session()
        try:
            result = session.execute(text(query), params or {})
            if query.strip().upper().startswith("SELECT"):
                rows = result.fetchall()
                return "\n".join(str(row) for row in rows)
            session.commit()
            return f"Query executed successfully. Rows affected: {result.rowcount}"
        except Exception as e:
            return f"Error executing query: {e}"
        finally:
            session.close()
