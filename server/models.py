# server/models.py
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


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


class Exercise(Base):
    __tablename__ = "exercises"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    defaultWeight = Column(Integer, nullable=True)
    defaultReps = Column(Integer, nullable=True)
    defaultUnit = Column(String, nullable=True)
    isFavorite = Column(Boolean, default=False)
    sortOrder = Column(Integer, nullable=True)
    deletedAt = Column(Integer, nullable=True)
    updatedAt = Column(Integer, nullable=False, index=True)
    deviceId = Column(String, nullable=False)
    version = Column(Integer, nullable=False, index=True)


class SetRecord(Base):
    __tablename__ = "sets"
    id = Column(String, primary_key=True, index=True)
    sessionId = Column(String, nullable=False)
    exerciseId = Column(String, nullable=False)
    weight = Column(Integer, nullable=False)
    reps = Column(Integer, nullable=False)
    unit = Column(String, nullable=True)
    rpe = Column(Integer, nullable=True)
    createdAt = Column(Integer, nullable=False)
    deletedAt = Column(Integer, nullable=True)
    updatedAt = Column(Integer, nullable=False, index=True)
    deviceId = Column(String, nullable=False)
    version = Column(Integer, nullable=False, index=True)


class VersionCounter(Base):
    """
    全域版本號：每次伺服端資料變更遞增，用於「拉取 version > lastKnownVersion 的變更」
    """
    __tablename__ = "version_counter"
    id = Column(Integer, primary_key=True, default=1)
    current = Column(Integer, nullable=False, default=1)