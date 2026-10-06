from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from instagrom.database import get_db
from instagrom.models import User, Story
from instagrom.auth import get_current_user_required

router = APIRouter(prefix="/api/stories", tags=["stories"])

class CreateStoryPayload(BaseModel):
    mediaUrl: str
    caption: Optional[str] = None

@router.get("")
def list_stories(db: Session = Depends(get_db)):
    stories = db.query(Story).order_by(desc(Story.createdAt)).all()

    grouped_map = {}
    for s in stories:
        if s.authorId not in grouped_map:
            grouped_map[s.authorId] = {
                "author": {
                    "id": s.author.id,
                    "username": s.author.username,
                    "displayName": s.author.displayName,
                    "profilePhoto": s.author.profilePhoto,
                } if s.author else None,
                "stories": [],
            }
        grouped_map[s.authorId]["stories"].append({
            "id": s.id,
            "mediaUrl": s.mediaUrl,
            "caption": s.caption,
            "createdAt": s.createdAt.isoformat() if s.createdAt else None,
        })

    return {"stories": list(grouped_map.values())}

@router.post("", status_code=status.HTTP_201_CREATED)
def create_story(
    payload: CreateStoryPayload,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    media_url = payload.mediaUrl.strip()
    if not media_url:
        raise HTTPException(status_code=400, detail="Story media URL is required")

    story = Story(
        authorId=current_user.id,
        mediaUrl=media_url,
        caption=payload.caption.strip() if payload.caption else None,
    )
    db.add(story)
    db.commit()
    db.refresh(story)

    return {
        "story": {
            "id": story.id,
            "mediaUrl": story.mediaUrl,
            "caption": story.caption,
            "createdAt": story.createdAt.isoformat() if story.createdAt else None,
            "author": {
                "id": current_user.id,
                "username": current_user.username,
                "displayName": current_user.displayName,
                "profilePhoto": current_user.profilePhoto,
            },
        }
    }
