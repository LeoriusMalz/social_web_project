from fastapi import APIRouter, Depends
from services.users import create_user, get_user
from db import get_db

router = APIRouter()

@router.post("/")
async def create_user_api(data: dict, db=Depends(get_db)):
    print(data)
    return await create_user(db, data["nickname"], data["email"])

@router.get("/{user_id}")
async def get_user_api(user_id: int, db=Depends(get_db)):
    print(await get_user(db, user_id))
    return await get_user(db, user_id)
