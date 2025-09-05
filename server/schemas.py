# server/schemas.py
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
try:
    # pydantic v2
    from pydantic import ConfigDict
    _HAS_V2 = True
except Exception:  # pydantic v1 fallback
    _HAS_V2 = False


# ---------- Auth ----------
class RegisterDeviceRequest(BaseModel):
    # 外部收 deviceId；內部使用 device_id
    device_id: Optional[str] = Field(default=None, alias="deviceId")

    if _HAS_V2:
        model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)
    else:
        class Config:
            allow_population_by_field_name = True
            # 回傳時也用 alias（camelCase）
            json_encoders: Dict = {}


class RegisterDeviceResponse(BaseModel):
    # 對外回傳 userId / deviceId / token
    user_id: str = Field(alias="userId")
    device_id: str = Field(alias="deviceId")
    token: str

    if _HAS_V2:
        model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)
    else:
        class Config:
            allow_population_by_field_name = True
            json_encoders: Dict = {}


# ---------- Sync payload ----------
class Session(BaseModel):
    id: str
    started_at: int = Field(alias="startedAt")
    ended_at: Optional[int] = Field(default=None, alias="endedAt")
    deleted_at: Optional[int] = Field(default=None, alias="deletedAt")
    updated_at: int = Field(alias="updatedAt")
    device_id: str = Field(alias="deviceId")

    if _HAS_V2:
        model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)
    else:
        class Config:
            allow_population_by_field_name = True


class Exercise(BaseModel):
    id: str
    name: str
    default_weight: Optional[float] = Field(default=None, alias="defaultWeight")
    default_reps: Optional[int] = Field(default=None, alias="defaultReps")
    default_unit: Optional[str] = Field(default=None, alias="defaultUnit")
    is_favorite: Optional[bool] = Field(default=None, alias="isFavorite")
    sort_order: Optional[int] = Field(default=None, alias="sortOrder")
    deleted_at: Optional[int] = Field(default=None, alias="deletedAt")
    updated_at: int = Field(alias="updatedAt")
    device_id: str = Field(alias="deviceId")

    if _HAS_V2:
        model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)
    else:
        class Config:
            allow_population_by_field_name = True


class SetRecord(BaseModel):
    id: str
    session_id: str = Field(alias="sessionId")
    exercise_id: str = Field(alias="exerciseId")
    weight: Optional[float] = None
    reps: Optional[int] = None
    unit: Optional[str] = None
    rpe: Optional[float] = None
    created_at: int = Field(alias="createdAt")
    deleted_at: Optional[int] = Field(default=None, alias="deletedAt")
    updated_at: int = Field(alias="updatedAt")
    device_id: str = Field(alias="deviceId")

    if _HAS_V2:
        model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)
    else:
        class Config:
            allow_population_by_field_name = True


class Changes(BaseModel):
    sessions: List[Session] = Field(default_factory=list)
    exercises: List[Exercise] = Field(default_factory=list)
    sets: List[SetRecord] = Field(default_factory=list)

    if _HAS_V2:
        model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)
    else:
        class Config:
            allow_population_by_field_name = True


class SyncRequest(BaseModel):
    device_id: str = Field(alias="deviceId")
    token: str
    last_version: int = Field(alias="lastVersion")
    changes: Changes = Field(default_factory=Changes)

    if _HAS_V2:
        model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)
    else:
        class Config:
            allow_population_by_field_name = True


# 回傳的變更內容不強制欄位結構，保持靈活
class SyncResult(BaseModel):
    sessions: List[Dict[str, Any]] = Field(default_factory=list)
    exercises: List[Dict[str, Any]] = Field(default_factory=list)
    sets: List[Dict[str, Any]] = Field(default_factory=list)

    if _HAS_V2:
        model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)
    else:
        class Config:
            allow_population_by_field_name = True


class SyncResponse(BaseModel):
    server_version: int = Field(alias="serverVersion")
    changes: SyncResult

    if _HAS_V2:
        model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)
    else:
        class Config:
            allow_population_by_field_name = True