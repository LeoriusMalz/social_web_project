from fastapi import Depends, HTTPException, Request, status

from db import get_db
from services.sessions import get_session_by_token

SESSION_COOKIE_NAME = "session_token"


async def get_current_user_optional(request: Request, db=Depends(get_db)):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        return None

    session = await get_session_by_token(db, session_token)
    if not session:
        return None

    return {
        "user_id": session["user_id"],
        "session_id": session["session_id"],
    }


async def require_authenticated_user(current_user=Depends(get_current_user_optional)):
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация",
        )

    return current_user
