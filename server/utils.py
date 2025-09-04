# server/utils.py
import uuid
import time
from sqlalchemy.orm import Session
from sqlalchemy import func

from . import models


def new_id() -> str:
    """產生一個隨機 ID（與前端 randomUUID 類似，含連字號）。"""
    return str(uuid.uuid4())


def now_ts() -> int:
    """目前時間（秒）。"""
    return int(time.time())


def get_current_version(db: Session) -> int:
    """
    目前的 server 版本：
    取三張表（sessions / exercises / sets）version 欄位最大值，若皆為 None 則為 0。
    這樣不需要另建 counter 表，也能確保版本單調遞增。
    """
    max_sess = db.query(func.max(models.Session.version)).scalar() or 0
    max_exer = db.query(func.max(models.Exercise.version)).scalar() or 0
    max_set = db.query(func.max(models.SetRecord.version)).scalar() or 0
    return max(max_sess, max_exer, max_set)


def bump_version(db: Session) -> int:
    """
    下一個版本號 = 當前最大版本 + 1。
    注意：在同一個 request 內若多次呼叫會連續增加（滿足每筆 upsert 都得到遞增 version）。
    """
    return (get_current_version(db) or 0) + 1