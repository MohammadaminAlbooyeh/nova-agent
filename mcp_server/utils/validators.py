import re
from urllib.parse import urlparse


def validate_url(url: str) -> bool:
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False


def validate_email(email: str) -> bool:
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email))


FORBIDDEN_SQL_KEYWORDS = ["DROP", "TRUNCATE", "ALTER", "CREATE", "GRANT", "REVOKE"]
IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

# Tables the SQL/DB tools must never expose to the agent, even though they
# live in the same application database as task/session logs: credentials
# and auth state, not data the agent is meant to read or write for a user.
SENSITIVE_TABLES = {"oauth_tokens", "oauth_client_credentials", "sessions"}


def validate_sql_query(query: str) -> bool:
    upper = query.strip().upper()
    for keyword in FORBIDDEN_SQL_KEYWORDS:
        if re.search(rf"\b{keyword}\b", upper):
            return False
    # Reject stacked statements / comment-based injection techniques.
    if ";" in query.strip().rstrip(";") or "--" in query or "/*" in query:
        return False
    for table in SENSITIVE_TABLES:
        if re.search(rf"\b{table}\b", query, re.IGNORECASE):
            return False
    return True


def validate_identifier(name: str) -> bool:
    """Validate a table or column name used as a raw SQL identifier.

    Table/column names can't be passed as bound query parameters, so they
    must be restricted to a strict alphanumeric+underscore pattern before
    being interpolated into a query string.
    """
    return bool(name) and bool(IDENTIFIER_PATTERN.match(name))


def validate_table_access(table: str) -> bool:
    """Reject access to tables that store credentials/auth state."""
    return validate_identifier(table) and table.lower() not in SENSITIVE_TABLES


def validate_file_path(path: str, base_dir: str = None) -> bool:
    import os

    base_dir = os.path.realpath(base_dir or os.getcwd())
    real_path = os.path.realpath(os.path.join(base_dir, path))
    return real_path == base_dir or real_path.startswith(base_dir + os.sep)
