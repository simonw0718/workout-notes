# server/crud.py
import logging
from sqlalchemy.orm import Session
from typing import List, Tuple
from . import models
from .utils import bump_version, get_current_version

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