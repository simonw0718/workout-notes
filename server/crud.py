# File: server/crud.py
import logging
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Tuple
from . import models
from .utils import bump_version, get_current_version
import time

log = logging.getLogger("sync-api")


def ensure_user_device_token(db: Session, user_id: str, device_id: str, token: str):
    user = db.get(models.User, user_id) or models.User(id=user_id)
    db.add(user)

    device = db.get(models.Device, device_id) or models.Device(
        id=device_id, user_id=user.id
    )
    db.add(device)

    # token 不是 PK，保守改為 query 避免不一致
    tk = db.query(models.Token).filter(models.Token.token == token).first()
    if not tk:
        tk = models.Token(token=token, user_id=user.id, device_id=device.id)
        db.add(tk)

    db.commit()
    log.info("ensure_user_device_token: user=%s device=%s token=%s", user_id, device_id, token)


def get_token_by_device(db: Session, device_id: str) -> models.Token | None:
    return db.query(models.Token).filter(models.Token.device_id == device_id).first()


def upsert_sessions(db: Session, rows: List[dict]) -> int:
    """
    支援 status 欄位（in_progress/ended）。
    若 client 上傳 ended 的紀錄，之後再上傳 in_progress 視為「接續同一筆」，覆寫 status。
    """
    version = get_current_version(db)
    for r in rows:
        cur = db.get(models.Session, r["id"])
        version = bump_version(db)
        if cur:
            for k, v in r.items():
                setattr(cur, k, v)
            cur.version = version
            db.add(cur)
        else:
            db.add(models.Session(version=version, **r))
    db.commit()
    log.info("upsert_sessions: %d", len(rows))
    return version


def upsert_exercises(db: Session, rows: List[dict]) -> int:
    """
    支援 category（upper/lower/core/other）與 defaultUnit（kg/lb/sec/min）。
    """
    version = get_current_version(db)
    for r in rows:
        cur = db.get(models.Exercise, r["id"])
        version = bump_version(db)
        if cur:
            for k, v in r.items():
                setattr(cur, k, v)
            cur.version = version
            db.add(cur)
        else:
            db.add(models.Exercise(version=version, **r))
    db.commit()
    log.info("upsert_exercises: %d", len(rows))
    return version


def upsert_sets(db: Session, rows: List[dict]) -> int:
    """
    支援 unit：kg/lb/sec/min（或 NULL）。
    """
    version = get_current_version(db)
    for r in rows:
        cur = db.get(models.SetRecord, r["id"])
        version = bump_version(db)
        if cur:
            for k, v in r.items():
                setattr(cur, k, v)
            cur.version = version
            db.add(cur)
        else:
            db.add(models.SetRecord(version=version, **r))
    db.commit()
    log.info("upsert_sets: %d", len(rows))
    return version


def list_changes_since(db: Session, since_version: int) -> Tuple[list, list, list, int]:
    sessions = (
        db.query(models.Session).filter(models.Session.version > since_version).all()
    )
    exercises = (
        db.query(models.Exercise).filter(models.Exercise.version > since_version).all()
    )
    sets = db.query(models.SetRecord).filter(models.SetRecord.version > since_version).all()
    cur = get_current_version(db)

    def to_dict(x):
        d = {c.name: getattr(x, c.name) for c in x.__table__.columns}
        return d

    return (
        [to_dict(s) for s in sessions],
        [to_dict(e) for e in exercises],
        [to_dict(z) for z in sets],
        cur,
    )


# -------- Phase 2: 新增輔助功能 --------

def continue_latest_session(db: Session, device_id: str) -> dict | None:
    """
    取「此裝置」最近一筆 session（包含已結束），將其狀態改為 in_progress 並清空 endedAt，回傳 dict。
    若不存在任何 session，回傳 None。
    """
    s = (
        db.query(models.Session)
        .filter(models.Session.deviceId == device_id)
        .order_by(desc(models.Session.updatedAt))
        .first()
    )
    if not s:
        return None

    # 將已結束的紀錄解鎖（或保持進行中）
    now_ms = int(time.time() * 1000)
    s.status = "in_progress"
    s.endedAt = None
    s.updatedAt = now_ms
    s.version = bump_version(db)
    db.add(s)
    db.commit()

    return {c.name: getattr(s, c.name) for c in s.__table__.columns}


def get_recent_exercises(db: Session, device_id: str, recent_sessions: int = 5, max_items: int = 50) -> list[dict]:
    """
    蒐集「此裝置」最近 N 筆 sessions（不含軟刪），抓出其中出現過的 exercise 去重後依時間排序回傳。
    """
    sess_rows = (
        db.query(models.Session)
        .filter(models.Session.deviceId == device_id)
        .filter(models.Session.deletedAt.is_(None))
        .order_by(desc(models.Session.updatedAt))
        .limit(recent_sessions)
        .all()
    )
    if not sess_rows:
        return []

    sess_ids = [s.id for s in sess_rows]
    set_rows = (
        db.query(models.SetRecord)
        .filter(models.SetRecord.sessionId.in_(sess_ids))
        .filter(models.SetRecord.deletedAt.is_(None))
        .order_by(desc(models.SetRecord.updatedAt))
        .all()
    )

    # 依最新出現順序去重
    seen = set()
    ordered_ex_ids = []
    for z in set_rows:
        if z.exerciseId not in seen:
            seen.add(z.exerciseId)
            ordered_ex_ids.append(z.exerciseId)
        if len(ordered_ex_ids) >= max_items:
            break
    if not ordered_ex_ids:
        return []

    # 取對應的 exercises（保留原順序）
    ex_map = {
        e.id: e
        for e in db.query(models.Exercise)
        .filter(models.Exercise.id.in_(ordered_ex_ids))
        .filter(models.Exercise.deletedAt.is_(None))
        .all()
    }
    out = []
    for ex_id in ordered_ex_ids:
        e = ex_map.get(ex_id)
        if not e:
            continue
        out.append({c.name: getattr(e, c.name) for c in e.__table__.columns})
    return out