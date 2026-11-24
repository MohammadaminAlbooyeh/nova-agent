from mcp_server.tools.base_tool import BaseTool
from mcp_server.utils.validators import validate_identifier, validate_sql_query


class DBReaderTool(BaseTool):
    def __init__(self):
        super().__init__()
        self.name = "db_reader"
        self.description = "Read data from database tables"
        self.input_schema = {
            "type": "object",
            "properties": {
                "table": {"type": "string", "description": "Table name"},
                "columns": {"type": "array", "items": {"type": "string"}, "description": "Columns to select"},
                "where": {"type": "string", "description": "WHERE clause"},
                "limit": {"type": "integer", "description": "Max rows"},
            },
            "required": ["table"],
        }

    async def execute(self, table: str, columns: list[str] = None, where: str = None, limit: int = 100) -> str:
        if not validate_identifier(table):
            return f"Rejected: invalid table name '{table}'"
        for column in columns or []:
            if not validate_identifier(column):
                return f"Rejected: invalid column name '{column}'"
        if where and not validate_sql_query(where):
            return "Rejected: WHERE clause contains a forbidden pattern"

        from backend.models.database import get_session
        cols = ", ".join(columns) if columns else "*"
        query = f"SELECT {cols} FROM {table}"
        if where:
            query += f" WHERE {where}"
        query += f" LIMIT {limit}"
        session = get_session()
        try:
            result = session.execute(query)
            rows = result.fetchall()
            return "\n".join(str(dict(row)) for row in rows)
        finally:
            session.close()
