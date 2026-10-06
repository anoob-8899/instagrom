import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from instagrom.database import get_db
from instagrom.models import User
from instagrom.auth import (
    hash_password,
    verify_password,
    is_valid_6digit_password,
    create_session,
    destroy_session,
    get_current_user_optional,
)
from instagrom.config import SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, COOKIE_SECURE

router = APIRouter(prefix="/api/auth", tags=["auth"])

USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9._]{3,30}$")

class LoginPayload(BaseModel):
    username: str
    password: str

class RegisterPayload(BaseModel):
    username: str
    password: str
    displayName: Optional[str] = None
    confirmPassword: Optional[str] = None

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )

def clear_auth_cookie(response: Response):
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
    )

def format_safe_user(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "displayName": user.displayName,
        "profilePhoto": user.profilePhoto,
        "bio": user.bio,
        "createdAt": user.createdAt.isoformat() if user.createdAt else None,
        "updatedAt": user.updatedAt.isoformat() if user.updatedAt else None,
    }

@router.post("/login")
def login(payload: LoginPayload, response: Response, db: Session = Depends(get_db)):
    username = payload.username.strip().lower()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required.")
    if not payload.password:
        raise HTTPException(status_code=400, detail="Password is required.")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    if not verify_password(payload.password, user.passwordHash):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    db_session = create_session(db, user.id)
    set_auth_cookie(response, db_session.sessionToken)

    return {
        "success": True,
        "message": "Logged in successfully.",
        "user": format_safe_user(user),
    }

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterPayload, response: Response, db: Session = Depends(get_db)):
    username = payload.username.strip().lower()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required.")

    if not USERNAME_REGEX.match(username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3-30 characters long and contain only letters, numbers, dots, or underscores.",
        )

    display_name = payload.displayName.strip() if payload.displayName and payload.displayName.strip() else username

    if not payload.password:
        raise HTTPException(status_code=400, detail="Password is required.")

    if not is_valid_6digit_password(payload.password):
        raise HTTPException(status_code=400, detail="Password must be exactly 6 numeric digits.")

    if payload.confirmPassword is not None and payload.password != payload.confirmPassword:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    # Check duplicate
    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Username already exists. Please choose a different one.",
        )

    pwd_hash = hash_password(payload.password)
    new_user = User(
        username=username,
        displayName=display_name,
        passwordHash=pwd_hash,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    db_session = create_session(db, new_user.id)
    set_auth_cookie(response, db_session.sessionToken)

    return {
        "success": True,
        "message": "Account created successfully.",
        "user": format_safe_user(new_user),
    }

@router.get("/me")
def me(current_user: Optional[User] = Depends(get_current_user_optional)):
    if not current_user:
        return {"user": None}
    return {"user": format_safe_user(current_user)}

@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token:
        destroy_session(db, token)
    clear_auth_cookie(response)
    return {"success": True, "message": "Logged out successfully."}
