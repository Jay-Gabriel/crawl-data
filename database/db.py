import sqlite3
import os
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "vietstock.db"
SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()
    conn.executescript(schema_sql)
    conn.commit()
    conn.close()
    print(f"[Database] Khởi tạo thành công CSDL tại {DB_PATH}")

if __name__ == "__main__":
    init_db()
