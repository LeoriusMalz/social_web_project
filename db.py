import asyncpg
from fastapi import Request
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def get_db(request: Request):
    async with request.app.state.pool.acquire() as conn:
        yield conn

async def create_pool():
    return await asyncpg.create_pool(DATABASE_URL)
