import re
import secrets
from datetime import datetime, timedelta
from typing import Optional
import bcrypt
from fastapi import Request, Depends, HTTPException, status
from sqlalchemy.orm import Session
from instagrom.database import get_db
from instagrom.models import User, Session as DbSession
from instagrom.config import SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, COOKIE_SECURE

SIX_DIGIT_PASSWORD_REGEX = re.compile(r"^\d{6}$")

def is_valid_6digit_password(password: str) -> bool:
    return bool(password and isinstance(password, str) and SIX_DIGIT_PASSWORD_REGEX.match(password))

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(10)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def generate_session_token() -> str:
    return secrets.token_hex(32)

def create_session(db: Session, user_id: str):
    token = generate_session_token()
    expires_at = datetime.utcnow() + timedelta(seconds=SESSION_MAX_AGE_SECONDS)
    db_session = DbSession(
        sessionToken=token,
        userId=user_id,
        expiresAt=expires_at,
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

def validate_session_token(db: Session, token: str) -> Optional[User]:
    if not token:
        return None
    try:
        db_session = db.query(DbSession).filter(DbSession.sessionToken == token).first()
        if not db_session:
            return None
        
        # Check expiration
        if db_session.expiresAt < datetime.utcnow():
            db.delete(db_session)
            db.commit()
            return None
        
        return db_session.user
    except Exception as e:
        print(f"Session validation error: {e}")
        return None

def destroy_session(db: Session, token: str):
    if not token:
        return
    try:
        db.query(DbSession).filter(DbSession.sessionToken == token).delete()
        db.commit()
    except Exception as e:
        print(f"Session destruction error: {e}")

def get_current_user_optional(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    # 1. From Cookie
    token = request.cookies.get(SESSION_COOKIE_NAME)
    
    # 2. From Cookie header fallback
    if not token:
        cookie_header = request.headers.get("cookie")
        if cookie_header:
            match = re.search(rf"(?:^|;\s*){SESSION_COOKIE_NAME}=([^;]+)", cookie_header)
            if match:
                token = match.group(1)
                
    # 3. From Authorization header fallback (Bearer ...)
    if not token:
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        return None

    return validate_session_token(db, token)

def get_current_user_required(user: Optional[User] = Depends(get_current_user_optional)) -> User:
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )
    return user
