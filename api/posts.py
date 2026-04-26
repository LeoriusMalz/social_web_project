from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from auth import require_authenticated_user
from db import get_db
from services.posts import create_post, get_post_by_id, get_post_file, get_post_owner, list_post_reaction_users, list_user_posts, set_post_reaction, soft_delete_post, unset_post_reaction

router = APIRouter()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


class ReactPostPayload(BaseModel):
    is_liked: bool


@router.get("/user/{user_id}")
async def get_user_posts(
    user_id: int,
    limit: int = Query(default=20, ge=1, le=50),
    before_post_id: int | None = Query(default=None, ge=1),
    current_user=Depends(require_authenticated_user),
    db=Depends(get_db),
):
    items = await list_user_posts(db, user_id, current_user["user_id"], limit, before_post_id)
    return {"items": items}


@router.get("/{post_id}/file")
async def get_post_file_api(post_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    owner_id = await get_post_owner(db, post_id)
    if owner_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пост не найден")

    content = await get_post_file(db, post_id)
    if not content:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")

    return StreamingResponse(iter([content]), media_type="image/*")


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_post_api(
    text_content: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    current_user=Depends(require_authenticated_user),
    db=Depends(get_db),
):
    file_content = None
    if file is not None:
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Недопустимый формат изображения")

        file_content = await file.read()
        if not file_content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл пуст")

    post_id = await create_post(db, current_user["user_id"], text_content, file_content)
    if post_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Пост не может быть пустым")

    post = await get_post_by_id(db, post_id, current_user["user_id"])
    return post


@router.post("/{post_id}/reaction")
async def react_post_api(post_id: int, payload: ReactPostPayload, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    owner_id = await get_post_owner(db, post_id)
    if owner_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пост не найден")

    await set_post_reaction(db, post_id, current_user["user_id"], payload.is_liked)
    post = await get_post_by_id(db, post_id, current_user["user_id"])
    return post


@router.post("/{post_id}/reaction/delete")
async def unreact_post_api(post_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    owner_id = await get_post_owner(db, post_id)
    if owner_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пост не найден")

    await unset_post_reaction(db, post_id, current_user["user_id"])
    post = await get_post_by_id(db, post_id, current_user["user_id"])
    return post


@router.get("/{post_id}/reactions/users")
async def get_post_reaction_users_api(post_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    owner_id = await get_post_owner(db, post_id)
    if owner_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пост не найден")

    liked = await list_post_reaction_users(db, post_id, True)
    disliked = await list_post_reaction_users(db, post_id, False)
    return {"liked": liked, "disliked": disliked}


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post_api(post_id: int, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    deleted = await soft_delete_post(db, post_id, current_user["user_id"])
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пост не найден")
