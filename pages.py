from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from auth import get_current_user_optional
from services.users import get_user_by_nickname

router = APIRouter()
templates = Jinja2Templates(directory="templates")


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, current_user=Depends(get_current_user_optional)):
    if current_user:
        return RedirectResponse(url=f"/id{current_user['user_id']}", status_code=302)

    return templates.TemplateResponse(request, "login.html", {"request": request})


@router.get("/register", response_class=HTMLResponse)
async def register_page(request: Request, current_user=Depends(get_current_user_optional)):
    if current_user:
        return RedirectResponse(url=f"/id{current_user['user_id']}", status_code=302)

    return templates.TemplateResponse(request, "register.html", {"request": request})


@router.get("/friends", response_class=HTMLResponse)
async def friends_page(request: Request, current_user=Depends(get_current_user_optional)):
    if not current_user:
        return RedirectResponse(url="/login", status_code=302)

    return templates.TemplateResponse(
        request,
        "friends.html",
        {
            "request": request,
            "current_user_id": current_user["user_id"],
            "active_page": "friends",
        },
    )


@router.get("/id@{nickname}", response_class=HTMLResponse)
async def profile_page_by_nickname(request: Request, nickname: str, current_user=Depends(get_current_user_optional)):
    if not current_user:
        return RedirectResponse(url="/login", status_code=302)

    user = await get_user_by_nickname(request.app.state.pool, nickname)
    if not user:
        user = dict()
        user['id'] = 0

    return RedirectResponse(url=f"/id{user['id']}", status_code=302)


@router.get("/id{user_id}", response_class=HTMLResponse)
async def profile_page(request: Request, user_id: int, current_user=Depends(get_current_user_optional)):
    if not current_user:
        return RedirectResponse(url="/login", status_code=302)

    context = {
        "request": request,
        "user_id": user_id,
        "is_owner": current_user["user_id"] == user_id,
        "current_user_id": current_user["user_id"],
        "active_page": "profile",
    }
    return templates.TemplateResponse(request, "profile.html", context)


@router.get("/settings", response_class=HTMLResponse)
async def settings_page(request: Request, current_user=Depends(get_current_user_optional)):
    if not current_user:
        return RedirectResponse(url="/login", status_code=302)

    return templates.TemplateResponse(
        request,
        "settings.html",
        {
            "request": request,
            "current_user_id": current_user["user_id"],
            "active_page": "settings",
        },
    )
