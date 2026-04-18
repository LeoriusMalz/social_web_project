from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field, field_validator

from auth import SESSION_COOKIE_NAME, require_authenticated_user
from db import get_db
from services.sessions import create_session, revoke_session_by_token
from services.users import check_user_exists, create_user, get_user, register_user, verify_user_credentials

router = APIRouter()


class RegisterUserRequest(BaseModel):
    nickname: str = Field(min_length=3, max_length=20)
    email: str
    name: str = Field(min_length=1, max_length=30)
    surname: str = Field(min_length=1, max_length=30)
    patronym: str | None = Field(default=None, max_length=40)
    sex: str
    password: str = Field(min_length=8, max_length=256)



    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        cleaned = value.strip()
        if "@" not in cleaned or "." not in cleaned.split("@")[-1]:
            raise ValueError("Введите корректную почту")
        return cleaned

    @field_validator("nickname", "name", "surname", mode="before")
    @classmethod
    def strip_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Поле не может быть пустым")
        return cleaned

    @field_validator("patronym", mode="before")
    @classmethod
    def strip_optional(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("sex")
    @classmethod
    def validate_sex(cls, value: str) -> str:
        if value not in {"М", "Ж"}:
            raise ValueError("Пол должен быть М или Ж")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value.strip()) < 8:
            raise ValueError("Пароль должен быть не менее 8 символов и не состоять из пробелов")
        if any(ch.isspace() for ch in value):
            raise ValueError("Пароль не должен содержать пробелы")
        return value


class LoginRequest(BaseModel):
    login: str
    password: str = Field(min_length=8, max_length=256)

    @field_validator("login")
    @classmethod
    def validate_login(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Введите логин или почту")
        return cleaned


@router.post("/")
async def create_user_api(data: dict, db=Depends(get_db)):
    return await create_user(db, data["nickname"], data["email"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user_api(payload: RegisterUserRequest, db=Depends(get_db)):
    exists = await check_user_exists(db, payload.nickname, payload.email)

    if exists["nickname_exists"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Логин уже занят")

    if exists["email_exists"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Почта уже используется")

    return await register_user(
        db,
        payload.nickname,
        payload.email,
        payload.name,
        payload.surname,
        payload.patronym,
        payload.sex,
        payload.password,
    )


@router.get("/check-availability")
async def check_user_availability(
    nickname: str = Query(min_length=3, max_length=20),
    email: str = Query(),
    db=Depends(get_db),
):
    email_cleaned = email.strip()
    if "@" not in email_cleaned or "." not in email_cleaned.split("@")[-1]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Некорректная почта")

    return await check_user_exists(db, nickname.strip(), email_cleaned)


@router.post("/login")
async def login_user(payload: LoginRequest, request: Request, response: Response, db=Depends(get_db)):
    user = await verify_user_credentials(db, payload.login, payload.password)

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный логин или пароль")

    session = await create_session(
        db,
        user_id=user["id"],
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session["token"],
        max_age=session["expires_in"],
        httponly=True,
        secure=False,
        samesite="lax",
        path="/",
    )

    return user


@router.post("/logout")
async def logout_user(request: Request, response: Response, db=Depends(get_db)):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)

    if session_token:
        await revoke_session_by_token(db, session_token)

    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/{user_id}")
async def get_user_api(user_id: int, db=Depends(get_db), _=Depends(require_authenticated_user)):
    user = await get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    return user