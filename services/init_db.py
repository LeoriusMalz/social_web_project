from utils.sql_loader import load_sql

init_sql = load_sql("init/schema.sql")

async def init_db(conn):
    await conn.execute(init_sql)
