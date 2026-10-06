import time
from datetime import datetime, timezone
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from instagrom.models import UserPresence
from instagrom.realtime import realtime_hub

# In-memory throttling cache: maps userId -> timestamp (in seconds) of last DB write
_last_db_write_cache: Dict[str, float] = {}
DB_WRITE_THROTTLE_SECONDS = 15
ONLINE_THRESHOLD_SECONDS = 60

def record_presence_heartbeat(db: Session, user_id: str):
    now_ts = time.time()
    last_write = _last_db_write_cache.get(user_id, 0.0)

    if now_ts - last_write >= DB_WRITE_THROTTLE_SECONDS:
        _last_db_write_cache[user_id] = now_ts
        try:
            now_dt = datetime.utcnow()
            presence = db.query(UserPresence).filter(UserPresence.userId == user_id).first()
            if presence:
                presence.lastSeenAt = now_dt
                presence.isOnline = True
            else:
                presence = UserPresence(
                    userId=user_id,
                    lastSeenAt=now_dt,
                    isOnline=True,
                )
                db.add(presence)
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Error updating user presence in SQLite: {e}")

def get_users_presence(db: Session, user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    if not user_ids:
        return {}

    presences = db.query(UserPresence).filter(UserPresence.userId.in_(user_ids)).all()
    presence_map = {p.userId: p for p in presences}

    result: Dict[str, Dict[str, Any]] = {}
    now_ts = time.time()

    for uid in user_ids:
        record = presence_map.get(uid)
        has_sse = realtime_hub.is_user_connected(uid)

        is_online = False
        last_seen_at = record.lastSeenAt if record else None

        if has_sse:
            is_online = True
        elif record and record.lastSeenAt:
            record_ts = record.lastSeenAt.replace(tzinfo=timezone.utc).timestamp() if record.lastSeenAt.tzinfo else record.lastSeenAt.timestamp()
            time_diff = now_ts - record_ts
            is_online = (time_diff < ONLINE_THRESHOLD_SECONDS)

        status_text = "Offline"
        if is_online:
            status_text = "Online"
        elif last_seen_at:
            record_ts = last_seen_at.replace(tzinfo=timezone.utc).timestamp() if last_seen_at.tzinfo else last_seen_at.timestamp()
            mins = int((now_ts - record_ts) / 60)
            if mins < 1:
                status_text = "Active just now"
            elif mins < 60:
                status_text = f"Active {mins}m ago"
            else:
                hours = int(mins / 60)
                if hours < 24:
                    status_text = f"Active {hours}h ago"
                else:
                    status_text = "Offline"

        result[uid] = {
            "isOnline": is_online,
            "lastSeenAt": last_seen_at.isoformat() if last_seen_at else None,
            "statusText": status_text,
        }

    return result
