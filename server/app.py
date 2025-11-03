# /server/app.py
from typing import Any, Optional, Callable

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from . import models, schemas
from .crud import (
    ensure_user_device_token,
    upsert_sessions, upsert_exercises, upsert_sets,
    list_changes_since, get_token_by_device,
    continue_latest_session, get_recent_exercises,
)
from .utils import new_id, get_current_version

# ✅ 新增：HIIT 子路由（/api/hiit/*）
from .hiit.router import hiit as hiit_router

# ---- DB 初始化 ----
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Workout Notes Sync API")

# ---- CORS 設定（允許 localhost/127.0.0.1 與區網 192.168.*）----
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3100",
    "http://127.0.0.1:3100",
    "http://192.168.31.241:3100",
    "http://192.168.31.241:3000",
    # 如果前端正式網域不同，記得加在這裡（例如 Cloudflare Pages）
    # "https://your-frontend.pages.dev",
    # "https://www.your-frontend.com",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"http://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ 掛上 HIIT 路由（它本身 prefix="/api/hiit"）
app.include_router(hiit_router)

# ---- 基本路由 ----
@app.get("/")
def root() -> dict[str, Any]:
    return {"ok": True, "name": "Workout Notes Sync API"}

@app.get("/health")
def health(db: Session = Depends(get_db)):
    """健康檢查：僅回傳目前 serverVersion。"""
    return {"ok": True, "serverVersion": get_current_version(db)}

# ---------- Auth：註冊裝置（冪等） ----------
@app.post("/auth/register-device", response_model=schemas.RegisterDeviceResponse)
def register_device(payload: schemas.RegisterDeviceRequest, db: Session = Depends(get_db)):
    device_id = payload.device_id or new_id()

    tk = get_token_by_device(db, device_id)
    if tk:
        return schemas.RegisterDeviceResponse(
            user_id=tk.user_id,
            device_id=device_id,
            token=tk.token,
        )

    user_id = new_id()
    token = new_id()
    ensure_user_device_token(db, user_id, device_id, token)

    return schemas.RegisterDeviceResponse(
        user_id=user_id,
        device_id=device_id,
        token=token,
    )

# ---------- Auth：以既有 userId 綁定當前裝置並核發新 token ----------
class AttachDevicePayload(BaseModel):
    user_id: str = Field(alias="userId")
    device_id: Optional[str] = Field(default=None, alias="deviceId")
    class Config:
        allow_population_by_field_name = True

@app.post("/auth/attach-device", response_model=schemas.RegisterDeviceResponse)
def attach_device(payload: AttachDevicePayload, db: Session = Depends(get_db)):
    device_id = payload.device_id or new_id()
    user_id = payload.user_id
    token = new_id()
    ensure_user_device_token(db, user_id, device_id, token)
    return schemas.RegisterDeviceResponse(user_id=user_id, device_id=device_id, token=token)

def verify_token(db: Session, token: str, device_id: str) -> models.Token:
    tk = db.get(models.Token, token)
    if not tk or tk.device_id != device_id:
        raise HTTPException(status_code=401, detail="Invalid token/device")
    return tk

# ---------- Sync ----------
@app.post("/sync", response_model=schemas.SyncResponse)
def sync(payload: schemas.SyncRequest, db: Session = Depends(get_db)):
    device_id = payload.device_id
    verify_token(db, payload.token, device_id)

    def to_dict(m: Any) -> dict:
        fn: Optional[Callable[[], dict]] = getattr(m, "model_dump", None) or getattr(m, "dict", None)
        return fn() if fn else dict(m)

    if payload.changes.sessions:
        upsert_sessions(db, [to_dict(r) for r in payload.changes.sessions])
    if payload.changes.exercises:
        upsert_exercises(db, [to_dict(r) for r in payload.changes.exercises])
    if payload.changes.sets:
        upsert_sets(db, [to_dict(r) for r in payload.changes.sets])

    s, e, z, cur = list_changes_since(db, payload.last_version)
    return schemas.SyncResponse(server_version=cur, changes=schemas.SyncResult(sessions=s, exercises=e, sets=z))

# ---------- Phase 2: 新增端點 ----------
class ContinuePayload(BaseModel):
    device_id: str = Field(alias="deviceId")
    token: str
    class Config:
        allow_population_by_field_name = True

@app.post("/sessions/continue")
def continue_session(payload: ContinuePayload, db: Session = Depends(get_db)):
    verify_token(db, payload.token, payload.device_id)
    s = continue_latest_session(db, device_id=payload.device_id)
    if not s:
        raise HTTPException(status_code=404, detail="No session to continue")
    return {"ok": True, "session": s}

@app.get("/exercises/recent")
def recent_exercises(
    deviceId: str = Query(...),
    token: str = Query(...),
    limitSessions: int = Query(5, ge=1, le=50),
    db: Session = Depends(get_db),
):
    verify_token(db, token, deviceId)
    items = get_recent_exercises(db, device_id=deviceId, recent_sessions=limitSessions)
    return {"ok": True, "items": items}