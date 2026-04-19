from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field, field_validator, model_validator

from auth import require_authenticated_user
from db import get_db
from services.settings import (
    change_password,
    clear_avatar,
    get_settings_user,
    is_email_taken_by_other,
    is_nickname_taken_by_other,
    is_phone_taken_by_other,
    list_marital_statuses,
    search_cities,
    update_avatar,
    update_settings_user,
    verify_old_password,
)

router = APIRouter()
PHONE_REGEX = "+7 (XXX) XXX-XX-XX"


class UpdateSettingsRequest(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    surname: str = Field(min_length=1, max_length=30)
    patronym: str | None = Field(default=None, max_length=40)
    nickname: str = Field(min_length=3, max_length=20)
    email: str
    phone: str | None = Field(default=None, max_length=18)
    sex: str
    marital_status_id: int | None = None
    city_id: int | None = None

    @field_validator("name", "surname", "nickname", mode="before")
    @classmethod
    def strip_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Поле не может быть пустым")
        return cleaned

    @field_validator("patronym", mode="before")
    @classmethod
    def clean_patronym(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("nickname")
    @classmethod
    def validate_nickname(cls, value: str) -> str:
        if any(ch.isspace() for ch in value):
            raise ValueError("Никнейм не должен содержать пробелы")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned or "@" not in cleaned or "." not in cleaned.split("@")[-1]:
            raise ValueError("Введите корректную почту")
        return cleaned

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if len(value) != 18 or not value.startswith("+7 ("):
            raise ValueError(f"Телефон должен быть в формате {PHONE_REGEX}")
        digits = [ch for ch in value if ch.isdigit()]
        if len(digits) != 11 or digits[0] != "7":
            raise ValueError(f"Телефон должен быть в формате {PHONE_REGEX}")
        return value

    @field_validator("sex")
    @classmethod
    def validate_sex(cls, value: str) -> str:
        if value not in {"М", "Ж"}:
            raise ValueError("Пол должен быть М или Ж")
        return value


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(min_length=8, max_length=256)
    new_password: str = Field(min_length=8, max_length=256)
    repeat_new_password: str = Field(min_length=8, max_length=256)

    @field_validator("old_password", "new_password", "repeat_new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value.strip()) < 8:
            raise ValueError("Пароль должен быть не менее 8 символов и не состоять из пробелов")
        if any(ch.isspace() for ch in value):
            raise ValueError("Пароль не должен содержать пробелы")
        return value

    @model_validator(mode="after")
    def validate_repeat(self):
        if self.new_password != self.repeat_new_password:
            raise ValueError("Новые пароли не совпадают")
        return self


@router.get("/me")
async def get_my_settings(current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    user = await get_settings_user(db, current_user["user_id"])
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    user["avatar_url"] = f"/api/users/{current_user['user_id']}/avatar" if user["has_avatar"] else None
    return user


@router.put("/me")
async def update_my_settings(payload: UpdateSettingsRequest, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    if await is_nickname_taken_by_other(db, payload.nickname, current_user["user_id"]):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Никнейм уже занят")

    if await is_email_taken_by_other(db, payload.email, current_user["user_id"]):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Почта уже используется")

    if payload.phone and await is_phone_taken_by_other(db, payload.phone, current_user["user_id"]):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Телефон уже используется")

    await update_settings_user(db, current_user["user_id"], payload.model_dump())
    return {"ok": True}


@router.get("/check-nickname")
async def check_nickname_for_settings(
    nickname: str = Query(min_length=3, max_length=20),
    current_user=Depends(require_authenticated_user),
    db=Depends(get_db),
):
    return {"is_taken": await is_nickname_taken_by_other(db, nickname.strip(), current_user["user_id"])}


@router.get("/check-email")
async def check_email_for_settings(email: str = Query(), current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    email_cleaned = email.strip()
    if "@" not in email_cleaned or "." not in email_cleaned.split("@")[-1]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Некорректная почта")

    return {"is_taken": await is_email_taken_by_other(db, email_cleaned, current_user["user_id"])}


@router.get("/marital-statuses")
async def get_marital_statuses(current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    return await list_marital_statuses(db)


@router.get("/cities")
async def get_cities(
    q: str = Query(min_length=1, max_length=100),
    current_user=Depends(require_authenticated_user),
    db=Depends(get_db),
):
    return await search_cities(db, q)


@router.post("/avatar")
async def upload_my_avatar(file: UploadFile = File(...), current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Можно загружать только изображения")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл пуст")

    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Максимальный размер изображения 5 MB")

    await update_avatar(db, current_user["user_id"], content)
    return {"ok": True, "avatar_url": f"/api/users/{current_user['user_id']}/avatar"}


@router.delete("/avatar")
async def delete_my_avatar(current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    await clear_avatar(db, current_user["user_id"])
    return {"ok": True}


@router.post("/password")
async def update_my_password(payload: ChangePasswordRequest, current_user=Depends(require_authenticated_user), db=Depends(get_db)):
    ok = await verify_old_password(db, current_user["user_id"], payload.old_password)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Старый пароль введен неверно")

    if payload.old_password == payload.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Новый пароль должен отличаться от старого")

    await change_password(db, current_user["user_id"], payload.new_password)
    return {"ok": True, "message": "Пароль успешно изменен"}
