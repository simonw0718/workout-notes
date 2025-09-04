# server/schemas.py
from typing import Optional, List
from pydantic import BaseModel


# -------------------------------
# Auth
# -------------------------------

class RegisterDeviceRequest(BaseModel):
    deviceId: Optional[str] = None  # 前端可能傳空字串或不傳，後端可自行產生


class RegisterDeviceResponse(BaseModel):
    userId: str
    deviceId: str
    token: str


# -------------------------------
# Sync 變更資料模型（與前端 IndexedDB schema 對齊）
# -------------------------------

class SessionIn(BaseModel):
    id: str
    startedAt: int
    endedAt: Optional[int] = None
    deletedAt: Optional[int] = None
    updatedAt: int
    deviceId: str

    class Config:
        orm_mode = True


class ExerciseIn(BaseModel):
    id: str
    name: str
    defaultWeight: Optional[int] = None
    defaultReps: Optional[int] = None
    defaultUnit: Optional[str] = None
    isFavorite: Optional[bool] = False
    sortOrder: Optional[int] = None
    deletedAt: Optional[int] = None
    updatedAt: int
    deviceId: str

    class Config:
        orm_mode = True


class SetRecordIn(BaseModel):
    id: str
    sessionId: str
    exerciseId: str
    weight: int
    reps: int
    unit: Optional[str] = None
    rpe: Optional[int] = None
    createdAt: int
    deletedAt: Optional[int] = None
    updatedAt: int
    deviceId: str

    class Config:
        orm_mode = True


class ChangesIn(BaseModel):
    sessions: List[SessionIn] = []
    exercises: List[ExerciseIn] = []
    sets: List[SetRecordIn] = []


class SyncRequest(BaseModel):
    deviceId: str
    token: str
    lastVersion: int = 0
    changes: ChangesIn


# -------------------------------
# Sync 回傳
# -------------------------------

# 伺服器回傳的變更（用 dict，避免與 ORM 直接耦合）
class SyncResult(BaseModel):
    sessions: List[dict]
    exercises: List[dict]
    sets: List[dict]


class SyncResponse(BaseModel):
    serverVersion: int
    changes: SyncResult