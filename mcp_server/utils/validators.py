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


def validate_sql_query(query: str) -> bool:
    upper = query.strip().upper()
    for keyword in FORBIDDEN_SQL_KEYWORDS:
        if re.search(rf"\b{keyword}\b", upper):
            return False
    return True


def validate_file_path(path: str, base_dir: str = None) -> bool:
    import os

    base_dir = os.path.realpath(base_dir or os.getcwd())
    real_path = os.path.realpath(os.path.join(base_dir, path))
    return real_path == base_dir or real_path.startswith(base_dir + os.sep)
