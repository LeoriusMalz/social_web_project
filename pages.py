from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter()
templates = Jinja2Templates(directory="templates")

@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse(request, "login.html", {"request": request})

@router.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse(request, "register.html", {"request": request})

@router.get("/friends", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse(request, "friends.html", {"request": request})

@router.get("/id{user_id}", response_class=HTMLResponse)
async def profile_page(request: Request, user_id: int):
    return templates.TemplateResponse(request, "profile.html", {"request": request, "user_id": user_id})
