# server/app.py
from typing import Any
import logging

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from . import models, schemas
from .crud import (
    ensure_user_device_token,
    upsert_sessions,
    upsert_exercises,
    upsert_sets,
    list_changes_since,
    get_token_by_device,
)
from .utils import new_id, get_current_version

# 建表
Base.metadata.create_all(bind=engine)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("sync-api")

app = FastAPI(title="Workout Notes Sync API")

# CORS：允許本地前端（開發常見 3000 / 3100）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3100",
        "http://127.0.0.1:3100",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, Any]:
    return {"ok": True, "name": "Workout Notes Sync API"}


# ---------- Auth：註冊裝置（冪等） ----------
@app.post("/auth/register-device", response_model=schemas.RegisterDeviceResponse)
def register_device(
    payload: schemas.RegisterDeviceRequest, db: Session = Depends(get_db)
):
    device_id = payload.deviceId or new_id()

    # 若該 device 已有 token，直接回傳（冪等）
    tk = get_token_by_device(db, device_id)
    if tk:
        log.info("register-device: reuse token for device=%s", device_id)
        return schemas.RegisterDeviceResponse(
            userId=tk.user_id, deviceId=device_id, token=tk.token
        )

    # 否則 → 建立 user / device / token
    user_id = new_id()
    token = new_id()
    ensure_user_device_token(db, user_id, device_id, token)
    log.info("register-device: new user=%s device=%s", user_id, device_id)

    return schemas.RegisterDeviceResponse(
        userId=user_id, deviceId=device_id, token=token
    )


def verify_token(db: Session, token: str, device_id: str) -> models.Token:
    tk = db.get(models.Token, token)
    if not tk or tk.device_id != device_id:
        raise HTTPException(status_code=401, detail="Invalid token/device")
    return tk


# ---------- Sync ----------
@app.post("/sync", response_model=schemas.SyncResponse)
def sync(payload: schemas.SyncRequest, db: Session = Depends(get_db)):
    # 1) 驗證 token + device
    verify_token(db, payload.token, payload.deviceId)

    # 2) 先處理 client changes → upsert 到 server，遞增 version
    cnt_s = cnt_e = cnt_z = 0
    if payload.changes.sessions:
        upsert_sessions(db, [r.dict() for r in payload.changes.sessions])
        cnt_s = len(payload.changes.sessions)
    if payload.changes.exercises:
        upsert_exercises(db, [r.dict() for r in payload.changes.exercises])
        cnt_e = len(payload.changes.exercises)
    if payload.changes.sets:
        upsert_sets(db, [r.dict() for r in payload.changes.sets])
        cnt_z = len(payload.changes.sets)
    log.info("sync: upsert s=%d e=%d z=%d", cnt_s, cnt_e, cnt_z)

    # 3) 回傳 server 端 version > lastVersion 的變更 + 最新 serverVersion
    s, e, z, cur = list_changes_since(db, payload.lastVersion)
    log.info("sync: return changes s=%d e=%d z=%d cur=%d", len(s), len(e), len(z), cur)

    return schemas.SyncResponse(
        serverVersion=cur, changes=schemas.SyncResult(sessions=s, exercises=e, sets=z)
    )


@app.get("/health")
def health(db: Session = Depends(get_db)):
    return {"ok": True, "serverVersion": get_current_version(db)}