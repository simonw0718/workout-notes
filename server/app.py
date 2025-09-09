# server/app.py
from typing import Any, Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from . import models, schemas
from .crud import (
    ensure_user_device_token,
    upsert_sessions, upsert_exercises, upsert_sets,
    list_changes_since, get_token_by_device
)
from .utils import new_id, get_current_version

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Workout Notes Sync API")

# CORS: 允許本地前端 (Next.js dev 常見兩種 :3000 / :3100)
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3100",
    "http://127.0.0.1:3100",
    "http://192.168.31.241:3100",

    # 手機連前端的位址 (請換成你自己的區網 IP)
    "http://192.168.31.241:3000",

    # 如果未來有 https / 反向代理，再把 https 加進來
    # "https://192.168.31.241:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?",  # 允許任何 192.168.x.x
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, Any]:
    return {"ok": True, "name": "Workout Notes Sync API"}


# ---------- Auth：註冊裝置（冪等） ----------
@app.post("/auth/register-device", response_model=schemas.RegisterDeviceResponse)
def register_device(payload: schemas.RegisterDeviceRequest, db: Session = Depends(get_db)):
    """
    若 deviceId 已有 token → 回傳原本 userId / token。
    若無 → 建立新 user / token 綁定此 device。
    """
    device_id = payload.deviceId or new_id()

    tk = get_token_by_device(db, device_id)
    if tk:
        return schemas.RegisterDeviceResponse(
            userId=tk.user_id,
            deviceId=device_id,
            token=tk.token,
        )

    user_id = new_id()
    token = new_id()
    ensure_user_device_token(db, user_id, device_id, token)

    return schemas.RegisterDeviceResponse(
        userId=user_id,
        deviceId=device_id,
        token=token,
    )


# ---------- Auth：以既有 userId 綁定當前裝置並核發新 token ----------
class AttachDevicePayload(BaseModel):
    userId: str
    deviceId: Optional[str] = None  # 若不給，伺服器會新產生

@app.post("/auth/attach-device", response_model=schemas.RegisterDeviceResponse)
def attach_device(payload: AttachDevicePayload, db: Session = Depends(get_db)):
    """
    給定既有 userId，將此（新或既有）device 綁到該 user，並為該 device 產生新的 token。
    與 register-device 的差別：不新建 user，而是「附掛」到已知 user。
    """
    device_id = payload.deviceId or new_id()
    user_id = payload.userId

    # 確保 user 存在；device 存在與否都沒關係，確保它歸屬 user，並核發新 token
    token = new_id()
    ensure_user_device_token(db, user_id, device_id, token)

    return schemas.RegisterDeviceResponse(
        userId=user_id,
        deviceId=device_id,
        token=token,
    )


def verify_token(db: Session, token: str, device_id: str) -> models.Token:
    """
    驗證 token 與 device 是否匹配；否則丟 401。
    """
    tk = db.get(models.Token, token)
    if not tk or tk.device_id != device_id:
        raise HTTPException(status_code=401, detail="Invalid token/device")
    return tk


# ---------- Sync ----------
@app.post("/sync", response_model=schemas.SyncResponse)
def sync(payload: schemas.SyncRequest, db: Session = Depends(get_db)):
    """
    1) 驗證 token + deviceId
    2) 將 client changes upsert 進 server，並遞增版本
    3) 回傳 serverVersion 與「server 端版本 > client lastVersion」的變更
    """
    verify_token(db, payload.token, payload.deviceId)

    # 2) 先處理 client 端傳上來的變更（可能為空）
    if payload.changes.sessions:
        upsert_sessions(db, [r.dict() for r in payload.changes.sessions])
    if payload.changes.exercises:
        upsert_exercises(db, [r.dict() for r in payload.changes.exercises])
    if payload.changes.sets:
        upsert_sets(db, [r.dict() for r in payload.changes.sets])

    # 3) 取出 server 端比 lastVersion 更新的資料
    s, e, z, cur = list_changes_since(db, payload.lastVersion)

    return schemas.SyncResponse(
        serverVersion=cur,
        changes=schemas.SyncResult(sessions=s, exercises=e, sets=z),
    )


@app.get("/health")
def health(db: Session = Depends(get_db)):
    return {"ok": True, "serverVersion": get_current_version(db)}