from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from db import create_pool
from api import friends, settings, users
import pages
from services.init_db import init_db
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    app.state.pool = await create_pool()
    print("DB pool created")

    async with app.state.pool.acquire() as conn:
        await init_db(conn)
        print("DB schema created")

    yield

    # shutdown
    await app.state.pool.close()
    print("DB pool closed")

app = FastAPI(lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(friends.router, prefix="/api/friends", tags=["friends"])

app.include_router(pages.router, tags=["pages"])
