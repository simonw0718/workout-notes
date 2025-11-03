# /server/hiit/router.py
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Dict
import uuid, datetime, json, os

hiit = APIRouter(prefix="/api/hiit", tags=["hiit"])

# ---------- Helpers ----------
def _id() -> str: return str(uuid.uuid4())
def _now_iso() -> str: return datetime.datetime.utcnow().isoformat()

# ---------- DTO: Exercises ----------
class HiitExercise(BaseModel):
    id: str
    name: str
    primaryCategory: Literal["cardio","lower","upper","core","full"]
    defaultMode: Literal["time"] = "time"
    defaultValue: int = 30
    movementType: List[str] = Field(default_factory=list)
    trainingGoal: List[str] = Field(default_factory=list)
    equipment: str = "無"   # 無 / 椅子 / 壺鈴 / 彈力帶 / 箱子或階梯 / 墊子 ...
    bodyPart: List[str] = Field(default_factory=list)
    cue: Optional[str] = None
    coachNote: Optional[str] = None
    isBilateral: bool = True
    deletedAt: Optional[str] = None

class HiitExerciseCreate(BaseModel):
    name: str
    primaryCategory: Literal["cardio","lower","upper","core","full"]
    defaultValue: int = 30
    movementType: List[str] = Field(default_factory=list)
    trainingGoal: List[str] = Field(default_factory=list)
    equipment: str = "無"
    bodyPart: List[str] = Field(default_factory=list)
    cue: Optional[str] = None
    coachNote: Optional[str] = None
    isBilateral: bool = True

class HiitExerciseUpdate(BaseModel):
    name: Optional[str] = None
    primaryCategory: Optional[Literal["cardio","lower","upper","core","full"]] = None
    defaultValue: Optional[int] = None
    movementType: Optional[List[str]] = None
    trainingGoal: Optional[List[str]] = None
    equipment: Optional[str] = None
    bodyPart: Optional[List[str]] = None
    cue: Optional[str] = None
    coachNote: Optional[str] = None
    isBilateral: Optional[bool] = None
    deletedAt: Optional[str] = None

# ---------- DTO: Workouts（最小可用） ----------
class HiitStepItem(BaseModel):
    order: int
    title: str
    work_sec: int = 20
    rest_sec: int = 10
    rounds: int = 1
    sets: int = 1
    inter_set_rest_sec: int = 0

class HiitWorkout(BaseModel):
    id: str
    name: str
    warmup_sec: int = 0
    cooldown_sec: int = 0
    steps: List[HiitStepItem] = Field(default_factory=list)
    deletedAt: Optional[str] = None

class HiitWorkoutCreate(BaseModel):
    name: str
    warmup_sec: int = 0
    cooldown_sec: int = 0
    steps: List[HiitStepItem] = Field(default_factory=list)

class HiitWorkoutUpdate(BaseModel):
    name: Optional[str] = None
    warmup_sec: Optional[int] = None
    cooldown_sec: Optional[int] = None
    steps: Optional[List[HiitStepItem]] = None
    deletedAt: Optional[str] = None

# ---------- In-Memory DB ----------
DB: Dict[str, Dict[str, dict]] = {
    "exercises": {},
    "workouts": {},
}

# ---------- Seed (exercises) ----------
def _clean_seed_item(it: dict) -> dict:
    data = dict(it)
    data.pop("id", None)
    data.pop("defaultMode", None)
    return data

def _seed_from_json():
    if DB["exercises"]:
        return
    base = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base, "seed_exercises.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            items = json.load(f)
        for it in items:
            data = _clean_seed_item(it)
            eid = _id()
            DB["exercises"][eid] = HiitExercise(id=eid, defaultMode="time", **data).model_dump()
        print(f"[HIIT] seed loaded: {len(DB['exercises'])} exercises")
    except Exception as e:
        print("[HIIT] seed load skipped:", e)

_seed_from_json()

# ---------- Utils ----------
def _text_hit(hay: str, q: str) -> bool:
    # 子字串包含比「全字相等」好用許多
    return q in hay

def _matches(item: dict, q: Optional[str], category: Optional[str],
             equipment: Optional[str], body_part: Optional[str],
             training_goal: Optional[str]) -> bool:
    # 不在這裡過濾 deleted；讓 /exercises 用 status 控制
    if category and item.get("primaryCategory") != category:
        return False
    if equipment and item.get("equipment") != equipment:
        return False
    if body_part and body_part not in (item.get("bodyPart") or []):
        return False
    if training_goal and training_goal not in (item.get("trainingGoal") or []):
        return False
    if q:
        ql = q.strip().lower()
        hay = " ".join([
            item.get("name",""),
            item.get("cue","") or "",
            item.get("coachNote","") or "",
            " ".join(item.get("movementType") or []),
            " ".join(item.get("trainingGoal") or []),
        ]).lower()
        if not _text_hit(hay, ql):
            return False
    return True

# ---------- Health ----------
@hiit.get("/health")
def health():
    return {"ok": True, "ts": _now_iso(), "exercises": len(DB["exercises"]), "workouts": len(DB["workouts"])}

# ---------- Exercises Routes ----------
@hiit.get("/exercises")
def list_exercises(
    q: Optional[str] = Query(None),
    category: Optional[Literal["cardio","lower","upper","core","full"]] = Query(None),
    equipment: Optional[str] = Query(None),
    bodyPart: Optional[str] = Query(None),
    goal: Optional[str] = Query(None),
    # 新增：status=no(預設，只回未刪) / only(只回已刪) / with(全部)
    status: Literal["no","only","with"] = Query("no"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    sort: Optional[Literal["name","category"]] = Query("name")
):
    rows = [v for v in DB["exercises"].values() if _matches(v, q, category, equipment, bodyPart, goal)]

    if status == "no":
        rows = [x for x in rows if not x.get("deletedAt")]
    elif status == "only":
        rows = [x for x in rows if x.get("deletedAt")]
    # status == "with" -> 不過濾

    if sort == "name":
        rows.sort(key=lambda x: x.get("name","").lower())
    elif sort == "category":
        rows.sort(key=lambda x: (x.get("primaryCategory",""), x.get("name","").lower()))
    return rows[offset: offset+limit]

@hiit.get("/exercises/{eid}")
def get_exercise(eid: str):
    it = DB["exercises"].get(eid)
    if not it or it.get("deletedAt"):
        raise HTTPException(404, "exercise not found")
    return it

@hiit.post("/exercises")
def create_exercise(dto: HiitExerciseCreate):
    eid = _id()
    ex = HiitExercise(id=eid, defaultMode="time", **dto.model_dump())
    DB["exercises"][eid] = ex.model_dump()
    return DB["exercises"][eid]

@hiit.put("/exercises/{eid}")
def update_exercise(eid: str, dto: HiitExerciseUpdate):
    it = DB["exercises"].get(eid)
    if not it or it.get("deletedAt"):
        raise HTTPException(404, "exercise not found")
    data = dto.model_dump(exclude_unset=True)
    it.update(data)
    DB["exercises"][eid] = it
    return it

@hiit.post("/exercises/{eid}/restore")
def restore_exercise(eid: str):
    it = DB["exercises"].get(eid)
    if not it:
        raise HTTPException(404, "exercise not found")
    it["deletedAt"] = None
    DB["exercises"][eid] = it
    return {"ok": True}

@hiit.delete("/exercises/{eid}")
def delete_exercise(eid: str, hard: bool = Query(False)):
    it = DB["exercises"].get(eid)
    if not it:
        raise HTTPException(404, "exercise not found")
    if hard:
        del DB["exercises"][eid]
        return {"ok": True, "hard": True}
    it["deletedAt"] = _now_iso()
    return {"ok": True, "hard": False}

@hiit.post("/dev/seed-exercises")
def dev_seed_exercises(force: bool = True):
    base = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base, "seed_exercises.json")
    if not os.path.exists(path):
        raise HTTPException(404, f"seed_exercises.json not found at {path}")
    try:
        with open(path, "r", encoding="utf-8") as f:
            items = json.load(f)
        if force:
            DB["exercises"].clear()
        for it in items:
            data = _clean_seed_item(it)
            eid = _id()
            DB["exercises"][eid] = HiitExercise(id=eid, defaultMode="time", **data).model_dump()
        return {"ok": True, "count": len(DB["exercises"])}
    except Exception as e:
        raise HTTPException(500, f"failed to load seed: {e}")

# ---------- Workouts Routes ----------
@hiit.get("/workouts")
def list_workouts(limit: int = 100, offset: int = 0):
    items = [w for w in DB["workouts"].values() if not w.get("deletedAt")]
    items.sort(key=lambda x: x.get("name","").lower())
    return items[offset: offset+limit]

@hiit.get("/workouts/{wid}")
def get_workout(wid: str):
    it = DB["workouts"].get(wid)
    if not it or it.get("deletedAt"):
        raise HTTPException(404, "workout not found")
    return it

@hiit.post("/workouts")
def create_workout(dto: HiitWorkoutCreate):
    wid = _id()
    w = HiitWorkout(id=wid, **dto.model_dump())
    DB["workouts"][wid] = w.model_dump()
    return DB["workouts"][wid]

@hiit.put("/workouts/{wid}")
def update_workout(wid: str, dto: HiitWorkoutUpdate):
    it = DB["workouts"].get(wid)
    if not it or it.get("deletedAt"):
        raise HTTPException(404, "workout not found")
    data = dto.model_dump(exclude_unset=True)
    it.update(data)
    DB["workouts"][wid] = it
    return it

@hiit.delete("/workouts/{wid}")
def delete_workout(wid: str, hard: bool = Query(False)):
    it = DB["workouts"].get(wid)
    if not it:
        raise HTTPException(404, "workout not found")
    if hard:
        del DB["workouts"][wid]
        return {"ok": True, "hard": True}
    it["deletedAt"] = _now_iso()
    return {"ok": True, "hard": False}