from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from instagrom.database import get_db
from instagrom.models import User, Post, Follow, SavedPost, Like, Comment
from instagrom.auth import get_current_user_optional, get_current_user_required
from instagrom.notifications import create_notification

router = APIRouter(prefix="", tags=["users"])

class UpdateProfilePayload(BaseModel):
    displayName: Optional[str] = None
    bio: Optional[str] = None
    profilePhoto: Optional[str] = None

@router.get("/api/users/suggested")
def get_suggested_users(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if current_user:
        query = query.filter(User.id != current_user.id)

    users = query.order_by(desc(User.createdAt)).limit(8).all()

    formatted = []
    for u in users:
        is_following = False
        if current_user:
            is_following = (
                db.query(Follow)
                .filter(Follow.followerId == current_user.id, Follow.followingId == u.id)
                .first()
                is not None
            )

        follower_count = db.query(Follow).filter(Follow.followingId == u.id).count()
        post_count = db.query(Post).filter(Post.authorId == u.id).count()

        formatted.append({
            "id": u.id,
            "username": u.username,
            "displayName": u.displayName,
            "profilePhoto": u.profilePhoto,
            "bio": u.bio,
            "followerCount": follower_count,
            "postCount": post_count,
            "isFollowing": is_following,
        })

    return {"users": formatted}

@router.get("/api/users/{username}")
def get_user_profile(
    username: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    clean_username = username.strip().lower()
    user = db.query(User).filter(User.username == clean_username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_self = (current_user is not None and current_user.id == user.id)

    is_following = False
    if current_user and not is_self:
        is_following = (
            db.query(Follow)
            .filter(Follow.followerId == current_user.id, Follow.followingId == user.id)
            .first()
            is not None
        )

    post_count = db.query(Post).filter(Post.authorId == user.id).count()
    follower_count = db.query(Follow).filter(Follow.followingId == user.id).count()
    following_count = db.query(Follow).filter(Follow.followerId == user.id).count()

    posts = (
        db.query(Post)
        .filter(Post.authorId == user.id)
        .order_by(desc(Post.createdAt))
        .all()
    )

    formatted_posts = [
        {
            "id": p.id,
            "imageUrl": p.imageUrl,
            "caption": p.caption,
            "createdAt": p.createdAt.isoformat() if p.createdAt else None,
            "likeCount": db.query(Like).filter(Like.postId == p.id).count(),
            "commentCount": db.query(Comment).filter(Comment.postId == p.id).count(),
        }
        for p in posts
    ]

    saved_posts_formatted = []
    if is_self and current_user:
        saved = (
            db.query(SavedPost)
            .filter(SavedPost.userId == current_user.id)
            .order_by(desc(SavedPost.createdAt))
            .all()
        )
        for s in saved:
            if s.post:
                saved_posts_formatted.append({
                    "id": s.post.id,
                    "imageUrl": s.post.imageUrl,
                    "caption": s.post.caption,
                    "createdAt": s.post.createdAt.isoformat() if s.post.createdAt else None,
                    "likeCount": db.query(Like).filter(Like.postId == s.post.id).count(),
                    "commentCount": db.query(Comment).filter(Comment.postId == s.post.id).count(),
                })

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "displayName": user.displayName,
            "profilePhoto": user.profilePhoto,
            "bio": user.bio,
            "createdAt": user.createdAt.isoformat() if user.createdAt else None,
            "postCount": post_count,
            "followerCount": follower_count,
            "followingCount": following_count,
            "isFollowing": is_following,
            "isSelf": is_self,
        },
        "posts": formatted_posts,
        "savedPosts": saved_posts_formatted,
    }

@router.post("/api/users/{username}/follow")
def toggle_follow_user(
    username: str,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    clean_username = username.strip().lower()
    target = db.query(User).filter(User.username == clean_username).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot follow yourself")

    existing = (
        db.query(Follow)
        .filter(Follow.followerId == current_user.id, Follow.followingId == target.id)
        .first()
    )

    is_following = False
    if existing:
        db.delete(existing)
        db.commit()
        is_following = False
    else:
        new_follow = Follow(followerId=current_user.id, followingId=target.id)
        db.add(new_follow)
        db.commit()
        is_following = True

        create_notification(
            db=db,
            recipient_id=target.id,
            actor_id=current_user.id,
            notif_type="FOLLOW",
        )

    follower_count = db.query(Follow).filter(Follow.followingId == target.id).count()
    my_following_count = db.query(Follow).filter(Follow.followerId == current_user.id).count()

    return {
        "isFollowing": is_following,
        "followerCount": follower_count,
        "myFollowingCount": my_following_count,
    }

@router.put("/api/profile")
def update_profile(
    payload: UpdateProfilePayload,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
):
    if payload.displayName is not None:
        name = payload.displayName.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Display name cannot be empty")
        if len(name) > 50:
            raise HTTPException(status_code=400, detail="Display name cannot exceed 50 characters")
        current_user.displayName = name

    if payload.bio is not None:
        bio_text = payload.bio.strip()
        if len(bio_text) > 300:
            raise HTTPException(status_code=400, detail="Bio cannot exceed 300 characters")
        current_user.bio = bio_text if bio_text else None

    if payload.profilePhoto is not None:
        current_user.profilePhoto = payload.profilePhoto if payload.profilePhoto else None

    db.commit()
    db.refresh(current_user)

    return {
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "displayName": current_user.displayName,
            "profilePhoto": current_user.profilePhoto,
            "bio": current_user.bio,
            "createdAt": current_user.createdAt.isoformat() if current_user.createdAt else None,
            "updatedAt": current_user.updatedAt.isoformat() if current_user.updatedAt else None,
        },
        "message": "Profile updated successfully",
    }
