from fastapi import APIRouter, Depends, HTTPException, Query, status

from auth import require_authenticated_user
from db import get_db
from services.friends import (
    accept_incoming_request,
    cancel_outgoing_request,
    get_relationship_status,
    list_friends,
    list_incoming_requests,
    list_outgoing_requests,
    list_user_followers,
    list_user_friends,
    reject_incoming_request,
    remove_friend_and_create_reverse_request,
    search_users_with_relationship,
    send_friend_request,
)
from services.users import get_user

router = APIRouter()


@router.get("/")
async def get_friends_list(current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    return await list_friends(db, current_user["user_id"])


@router.get("/incoming")
async def get_incoming_requests(current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    return await list_incoming_requests(db, current_user["user_id"])


@router.get("/outgoing")
async def get_outgoing_requests(current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    return await list_outgoing_requests(db, current_user["user_id"])


@router.get("/search")
async def search_users(
    q: str = Query(min_length=1, max_length=100),
    current_user=Depends(require_authenticated_user),
    db=Depends(get_db),
):
    return await search_users_with_relationship(db, current_user["user_id"], q)


@router.get("/relationship/{user_id}")
async def get_relationship(user_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    relation = await get_relationship_status(db, current_user["user_id"], user_id)
    return {"relation": relation}


@router.post("/requests/{user_id}")
async def create_request(user_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    result = await send_friend_request(db, current_user["user_id"], user_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя добавить себя")
    return result


@router.post("/incoming/{user_id}/accept")
async def accept_request(user_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    result = await accept_incoming_request(db, current_user["user_id"], user_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    return {"ok": True}


@router.post("/incoming/{user_id}/reject")
async def reject_request(user_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    result = await reject_incoming_request(db, current_user["user_id"], user_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    return {"ok": True}


@router.post("/outgoing/{user_id}/cancel")
async def cancel_request(user_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    result = await cancel_outgoing_request(db, current_user["user_id"], user_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заявка не найдена")
    return {"ok": True}


@router.delete("/{user_id}")
async def remove_friend(user_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    result = await remove_friend_and_create_reverse_request(db, current_user["user_id"], user_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Дружба не найдена")
    return {"ok": True}


@router.get("/user/{user_id}/friends")
async def get_user_friends(user_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    return await list_user_friends(db, user_id)


@router.get("/user/{user_id}/followers")
async def get_user_followers(user_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    return await list_user_followers(db, user_id)
