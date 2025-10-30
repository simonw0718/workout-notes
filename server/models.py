# File: server/models.py
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

# ---- 新增：系統層級枚舉（以字串+CHECK 限制，SQLite 友好） ----
CATEGORY_VALUES = ("upper", "lower", "core", "other")
UNIT_VALUES = ("kg", "lb", "sec", "min")
SESSION_STATUS_VALUES = ("in_progress", "ended")


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)  # uuid
    created_at = Column(DateTime, default=datetime.utcnow)


class Device(Base):
    __tablename__ = "devices"
    id = Column(String, primary_key=True, index=True)  # deviceId (uuid or client provided)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")


class Token(Base):
    __tablename__ = "tokens"
    token = Column(String, primary_key=True, index=True)  # bearer token
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    device_id = Column(String, ForeignKey("devices.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")
    device = relationship("Device")


# 伺服端三張資料表：sessions / exercises / sets
# 採用 version（自增整數）+ updated_at + deleted_at（軟刪）
class Session(Base):
    __tablename__ = "sessions"
    id = Column(String, primary_key=True, index=True)
    startedAt = Column(Integer, nullable=False)   # ms timestamp
    endedAt = Column(Integer, nullable=True)
    deletedAt = Column(Integer, nullable=True)
    updatedAt = Column(Integer, nullable=False, index=True)
    deviceId = Column(String, nullable=False)
    version = Column(Integer, nullable=False, index=True)

    # 新增：可接續的狀態欄位（預設進行中）
    status = Column(String, nullable=False, default="in_progress")

    __table_args__ = (
        CheckConstraint(
            f"status IN {SESSION_STATUS_VALUES}",
            name="ck_sessions_status",
        ),
    )


class Exercise(Base):
    __tablename__ = "exercises"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)

    # ※ defaultWeight / defaultReps / defaultUnit 為相容保留
    #   defaultUnit 現在支援 kg/lb/sec/min（由前端與驗證把關；DB 以 CHECK＋NULL 允許）
    defaultWeight = Column(Integer, nullable=True)
    defaultReps = Column(Integer, nullable=True)
    defaultUnit = Column(String, nullable=True)

    # 舊有收藏/排序語意保留（之後不再於 UI 廣用，但為相容不移除）
    isFavorite = Column(Boolean, default=False)
    sortOrder = Column(Integer, nullable=True)

    deletedAt = Column(Integer, nullable=True)
    updatedAt = Column(Integer, nullable=False, index=True)
    deviceId = Column(String, nullable=False)
    version = Column(Integer, nullable=False, index=True)

    # 新增：分類（系統屬性，預設 other）
    category = Column(String, nullable=False, default="other")

    __table_args__ = (
        CheckConstraint(
            f"category IN {CATEGORY_VALUES}",
            name="ck_exercises_category",
        ),
        # defaultUnit 可為 NULL；若不為 NULL 限制在四種單位
        CheckConstraint(
            f"(defaultUnit IS NULL) OR (defaultUnit IN {UNIT_VALUES})",
            name="ck_exercises_default_unit",
        ),
    )


class SetRecord(Base):
    __tablename__ = "sets"
    id = Column(String, primary_key=True, index=True)
    sessionId = Column(String, nullable=False)
    exerciseId = Column(String, nullable=False)
    weight = Column(Integer, nullable=False)
    reps = Column(Integer, nullable=False)
    unit = Column(String, nullable=True)  # 支援 kg/lb/sec/min（或 NULL）
    rpe = Column(Integer, nullable=True)
    createdAt = Column(Integer, nullable=False)
    deletedAt = Column(Integer, nullable=True)
    updatedAt = Column(Integer, nullable=False, index=True)
    deviceId = Column(String, nullable=False)
    version = Column(Integer, nullable=False, index=True)

    __table_args__ = (
        CheckConstraint(
            f"(unit IS NULL) OR (unit IN {UNIT_VALUES})",
            name="ck_sets_unit",
        ),
    )


class VersionCounter(Base):
    """
    全域版本號：每次伺服端資料變更遞增，用於「拉取 version > lastKnownVersion 的變更」
    """
    __tablename__ = "version_counter"
    id = Column(Integer, primary_key=True, default=1)
    current = Column(Integer, nullable=False, default=1)