import os

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

def load_sql(path: str) -> str:
    full_path = os.path.join(BASE_DIR, "queries", path)
    with open(full_path, "r") as f:
        return f.read()
