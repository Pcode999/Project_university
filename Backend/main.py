# main.py — FastAPI + Eye-only sleep detection + Face recognition + MJPEG stream (FULL)

from fastapi import FastAPI, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, EmailStr
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
from typing import Dict, Any, List
import shutil
import os
import base64
from PIL import Image
from io import BytesIO
import cv2
import numpy as np
import time
import asyncio
from starlette.requests import Request
from starlette.responses import StreamingResponse
import httpx

# ใช้ landmark เพื่อหา “ดวงตา”
import face_recognition as fr

from face_recognizer import FaceRecognizer
from sleep_detector import SleepDetector

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # โปรดจำกัดโดเมนจริงเมื่อขึ้นโปรดักชัน
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# ===== DB =====
client = MongoClient("mongodb://localhost:27017/")
db = client["Project_sleep_classroom"]
users_collection = db["users"]
behavior_collection = db["student_behavior_report"]

# ===== AI components =====
face_recognizer = FaceRecognizer()
sleep_detector = SleepDetector()

# ===== Stream state =====
is_streaming: bool = False
latest_status: Dict[str, Any] = {
    "label": None,
    "confidence": None,
    "faces": [],
    "per_eye": [],
    "timestamp": None,
    "snapshot": None,
}

# ---- เพิ่มตัวแปรตรวจหลับต่อเนื่อง ----
sleep_threshold_sec: float = 3.0          # ครบกี่วินาทีจึงถือว่า Sleep
sleep_start_time: float | None = None     # ระดับภาพรวม (กรณีไม่มีใบหน้าชัดเจน)
sleep_timers: Dict[str, float | None] = {}  # ระดับรายบุคคล key=ชื่อ (รวม Unknown)

# ===== Schemas =====
class FrameData(BaseModel):
    image: str

class User(BaseModel):
    username: str
    email: EmailStr
    password: str
    profileImage: str
    role: str

class UserLogin(BaseModel):
    username: str
    password: str

class Behavior(BaseModel):
    student_id: str
    penalty: int
    created_at: datetime
    
    
# Sleep detection route


    

# ===== Helpers =====
def serialize_user(user):
    return {
        "_id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
        "password": user["password"],
        "profileImage": user["profileImage"],
        "role": user["role"],
    }

def serialize_behavior(behavior):
    return {
        "id": str(behavior["_id"]),
        "student_id": behavior["student_id"],
        "penalty": behavior["penalty"],
        "created_at": behavior["created_at"],
        "status": behavior.get("status", "active"),
    }

def _clip(v, lo, hi):
    return max(lo, min(int(v), hi))

def extract_eye_crops(frame_bgr) -> List[np.ndarray]:
    """ คืนลิสต์รูปตา [left, right] จากเฟรม ถ้าไม่เจอ → [] """
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    landmarks_list = fr.face_landmarks(rgb)
    H, W = frame_bgr.shape[:2]
    eye_crops: List[np.ndarray] = []
    for lm in landmarks_list:
        if "left_eye" in lm and "right_eye" in lm:
            for eye_key in ["left_eye", "right_eye"]:
                pts = lm[eye_key]
                xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
                x_min, x_max = min(xs), max(xs)
                y_min, y_max = min(ys), max(ys)
                w = x_max - x_min; h = y_max - y_min
                pad = int(0.3 * max(w, h))
                x0 = _clip(x_min - pad, 0, W - 1)
                y0 = _clip(y_min - pad, 0, H - 1)
                x1 = _clip(x_max + pad, 0, W - 1)
                y1 = _clip(y_max + pad, 0, H - 1)
                crop = frame_bgr[y0:y1, x0:x1].copy()
                if crop.size > 0:
                    eye_crops.append(crop)
        if eye_crops:
            break
    return eye_crops

def predict_from_eyes(frame_bgr, min_conf_for_closed=70.0):
    """
    รวมผลจากตาซ้าย/ขวา → (label, conf, per_eye)
      - per_eye: [{"eye": "left"/"right", "label": "Open/Closed", "conf": float}, ...]
      - label/ conf ระดับภาพ: ใช้ rule-based ตาม per_eye
    """
    eyes = extract_eye_crops(frame_bgr)
    per_eye = []
    if eyes:
        for i, eye in enumerate(eyes):
            lbl, conf = sleep_detector.predict_from_array(eye, resize=True)
            per_eye.append({
                "eye": "left" if i == 0 else "right",
                "label": lbl,
                "conf": float(conf),
            })
        closed_votes = [e for e in per_eye if e["label"].lower() == "closed" and e["conf"] >= min_conf_for_closed]
        if closed_votes:
            return "Closed", float(max(e["conf"] for e in closed_votes)), per_eye
        open_votes = [e for e in per_eye if e["label"].lower() == "open"]
        return "Open", float(max([e["conf"] for e in open_votes], default=0.0)), per_eye

    # fallback: ใช้ทั้งเฟรม (กรณี landmark ไม่เจอ)
    lbl, conf = sleep_detector.predict_from_array(frame_bgr, resize=True)
    return lbl, float(conf), per_eye

# ===== Users & Behavior routes =====

class WhoSleepData(BaseModel):
    name: str
    time: str
    
class DeleteSleepData(BaseModel):
    name: str

sleepingList: List = []

@app.get('/who-sleeping')
async def get_who_sleeping():
    return {"list": sleepingList}
@app.delete('/who-sleeping')
async def delete_who_sleeping(data: DeleteSleepData):
    global sleepingList
    sleepingList = [entry for entry in sleepingList if entry["name"] != data.name]
    return {"message": "Deleted from sleeping list", "list": sleepingList}

@app.post('/who-sleeping')
async def post_who_sleeping(data: WhoSleepData):
    global sleepingList
    sleepingList.append({"name": data.name, "time": data.time})
    if len(sleepingList) > 5:
        sleepingList = sleepingList[-5:]
    return {"message": "Added to sleeping list", "list": sleepingList}

@app.post("/signup")
async def signup(user: User):
    if users_collection.find_one({"email": user.email}) or users_collection.find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="Username or email already exists")
    users_collection.insert_one(user.dict())
    return {"message": "User registered successfully"}

@app.post("/login")
async def login(user: UserLogin):
    found = users_collection.find_one({"username": user.username, "password": user.password})
    if not found:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {
        "message": "Login successful",
        "id": str(found["_id"]),
        "username": found["username"],
        "email": found["email"],
        "profileImage": found["profileImage"],
        "role": found["role"],
    }

@app.get("/users")
async def get_users():
    users = users_collection.find()
    return [serialize_user(u) for u in users]

@app.get("/search-students")
async def search_students(name: str = ""):
    results = users_collection.find({"role": "student", "username": {"$regex": name, "$options": "i"}})
    return [serialize_user(u) for u in results]

@app.get("/student/{username}")
async def get_student_by_username(username: str):
    user = users_collection.find_one({"username": username, "role": "student"})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "_id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
        "profileImage": user["profileImage"],
        "role": user["role"],
    }

@app.put("/users/{user_id}")
async def update_user(user_id: str, user: User):
    result = users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": user.dict()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User updated successfully"}

@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str):
    result = users_collection.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

@app.get("/behavior-reports")
async def get_all_behavior_reports():
    reports = behavior_collection.find()
    return [serialize_behavior(r) for r in reports]

@app.get("/behavior-reports/{report_id}")
async def get_behavior_report(report_id: str):
    report = None
    if len(report_id) == 24:
        try:
            report = behavior_collection.find_one({"_id": ObjectId(report_id)})
        except Exception:
            report = None
    if not report:
        report = behavior_collection.find_one({"_id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail=f"Behavior report with ID '{report_id}' not found")
    return serialize_behavior(report)

@app.get("/behavior-reports/student/{student_id}")
async def get_student_behavior_reports(student_id: str):
    reports = behavior_collection.find({"student_id": student_id})
    return [serialize_behavior(r) for r in reports]

@app.post("/behavior-reports")
async def create_behavior_report(behavior: Behavior):
    d = behavior.dict()
    d["created_at"] = datetime.now()
    d["status"] = "active"
    result = behavior_collection.insert_one(d)
    new_report = behavior_collection.find_one({"_id": result.inserted_id})
    return serialize_behavior(new_report)

@app.put("/behavior-reports/{report_id}")
async def update_behavior_report(report_id: str, behavior: Behavior):
    d = behavior.dict()
    d["updated_at"] = datetime.now()
    result = None
    if len(report_id) == 24:
        try:
            result = behavior_collection.update_one({"_id": ObjectId(report_id)}, {"$set": d})
        except Exception:
            result = None
    if not result or result.matched_count == 0:
        result = behavior_collection.update_one({"_id": report_id}, {"$set": d})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Behavior report not found")
    updated = behavior_collection.find_one({"_id": ObjectId(report_id) if len(report_id) == 24 else report_id})
    return serialize_behavior(updated)

@app.delete("/behavior-reports/{report_id}")
async def delete_behavior_report(report_id: str):
    result = None
    if len(report_id) == 24:
        try:
            result = behavior_collection.delete_one({"_id": ObjectId(report_id)})
        except Exception:
            result = None
    if not result or result.deleted_count == 0:
        result = behavior_collection.delete_one({"_id": report_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Behavior report not found")
    return {"message": "Behavior report deleted successfully"}

@app.post("/upload-profile-image")
async def upload_profile_image(file: UploadFile = File(...)):
    try:
        name = file.filename.lower().strip()
        path = f"static/{name}"
        with open(path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"image_url": f"http://localhost:8000/static/{name}"}
    except:
        raise HTTPException(status_code=500, detail="Upload failed")

# ====== Process single frame (base64), เผื่อเรียกทดสอบเดี่ยว ======
@app.post("/process_frame")
async def process_frame(frame: FrameData):
    try:
        if not frame.image.startswith('data:image'):
            raise HTTPException(status_code=400, detail="Invalid base64 format")
        img_data = base64.b64decode(frame.image.split(',')[1])
        img = Image.open(BytesIO(img_data))
        img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

        label, conf, per_eye = predict_from_eyes(img)
        face_locations, names = face_recognizer.recognize_faces(img)

        result = {
            "status": "Frame processed",
            "prediction": {"label": label, "confidence": conf},
            "per_eye": per_eye,
            "recognized_faces": [
                {"name": n, "box": (l, t, r, b)}
                for (t, r, b, l), n in zip(face_locations, names)
            ],
        }
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error: {e}")

# ====== Streaming control & status ======
@app.post("/start_stream")
async def start_stream():
    global is_streaming, sleep_start_time, sleep_timers
    is_streaming = True
    # รีเซ็ตตัวนับเมื่อเริ่มใหม่
    sleep_start_time = None
    sleep_timers = {}
    return {"message": "Video stream started", "status": "success"}

@app.post("/stop_stream")
async def stop_stream():
    global is_streaming
    is_streaming = False
    return {"message": "Video stream stopped", "status": "success"}

@app.get("/stream_status")
async def get_stream_status():
    return JSONResponse({"is_streaming": is_streaming, "status": latest_status})

async def _open_camera():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise HTTPException(status_code=500, detail="Cannot open camera")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    return cap

async def _close_camera(cap):
    try:
        cap.release()
    except:
        pass

BOUNDARY = "frame"

def _multipart_chunk(img_bytes: bytes) -> bytes:
    head = (
        f"--{BOUNDARY}\r\n"
        "Content-Type: image/jpeg\r\n"
        f"Content-Length: {len(img_bytes)}\r\n\r\n"
    ).encode("utf-8")
    return head + img_bytes + b"\r\n"


@app.get("/video_feed")
async def video_feed(request: Request):
    global is_streaming, latest_status, sleep_start_time, sleep_timers
    if not is_streaming:
        raise HTTPException(status_code=400, detail="Stream not started")

    cap = await _open_camera()

    async def gen():
        nonlocal cap
        try:
            while is_streaming:
                if await request.is_disconnected():
                    break

                ok, frame = cap.read()
                if not ok:
                    await asyncio.sleep(0.02)
                    continue

                # ใช้กล้องหน้า
                frame = cv2.flip(frame, 1)

                # 1) หาใบหน้า + ชื่อ
                try:
                    face_locations, names = face_recognizer.recognize_faces(frame)
                except Exception:
                    face_locations, names = [], []

                faces_info = []  # เก็บผลรายคนสำหรับส่งสถานะ

                # 2) ตรวจตา “รายคน” แล้ววาดผลไว้ตรงหน้าคนนั้น
                for (top, right, bottom, left), name in zip(face_locations, names):
                    # กัน index หลุดขอบ
                    top = max(0, top); left = max(0, left)
                    bottom = min(frame.shape[0]-1, bottom)
                    right  = min(frame.shape[1]-1, right)

                    face_crop = frame[top:bottom, left:right].copy()
                    try:
                        label, conf, per_eye = predict_from_eyes(face_crop)
                    except Exception:
                        label, conf, per_eye = "Unknown", 0.0, []

                    # ---- นับเวลาต่อเนื่องรายบุคคล ----
                    now = time.time()
                    key = name if name else "Unknown"
                    prev = sleep_timers.get(key)

                    display_label = label
                    sleep_elapsed = 0.0

                    if label.lower() == "closed":
                        if prev is None:
                            sleep_timers[key] = now
                            sleep_elapsed = 0.0
                        else:
                            sleep_elapsed = now - prev
                            if sleep_elapsed >= sleep_threshold_sec:
                                display_label = "Sleep"  # เปลี่ยนป้ายเมื่อครบเวลา
                                async with httpx.AsyncClient() as client:
                                    try:
                                        print(f"📢 แจ้งเตือน {key} หลับแล้ว")
                                        await client.post(
                                            "http://localhost:8000/who-sleeping",
                                            json={"name": key, "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
                                        )
                                    except Exception:
                                        pass
                                
                    else:
                        # เปิดตา → รีเซ็ตตัวนับ
                        sleep_timers[key] = None

                    faces_info.append({
                        "name": name,
                        "label": label,                 # label จากโมเดล
                        "display_label": display_label, # label ที่โชว์ (Sleep/Closed/Open)
                        "sleep_elapsed": round(sleep_elapsed, 2),
                        "confidence": float(conf),
                        "box": [int(left), int(top), int(right), int(bottom)],
                        "per_eye": per_eye
                    })

                    # สีกรอบ/พื้นข้อความ
                    is_sleep = (display_label.lower() == "sleep")
                    is_closed = (display_label.lower() == "closed")
                    if is_sleep:
                        box_color = (0, 0, 255)     # แดง: Sleep
                    elif is_closed:
                        box_color = (40, 40, 220)   # น้ำเงินเข้ม: Closed (กำลังนับเวลา)
                    else:
                        box_color = (36, 255, 12)   # เขียว: Open/อื่นๆ
                    txt_color = (255, 255, 255)

                    # วาดกรอบหน้า
                    cv2.rectangle(frame, (left, top), (right, bottom), box_color, 2)

                    # แถบหัว: ชื่อ | สถานะ (%)
                    head = f"{name} | {display_label} ({conf:.0f}%)"
                    (tw, th), _ = cv2.getTextSize(head, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                    pad = 6
                    y_text = max(0, top - th - 10)
                    cv2.rectangle(
                        frame,
                        (left, y_text - pad),
                        (left + tw + pad*2, y_text + th + pad),
                        box_color, -1
                    )
                    cv2.putText(
                        frame, head,
                        (left + pad, y_text + th),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, txt_color, 2, cv2.LINE_AA
                    )

                    # per-eye ใต้หัว (ซ้าย/ขวาแยกเปอร์เซ็นต์)
                    y_line = y_text + th + pad + 22
                    for e in (per_eye or []):
                        line = f"{e['eye']}: {e['label']} ({e['conf']:.0f}%)"
                        cv2.putText(
                            frame, line,
                            (left, min(y_line, bottom - 8)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, box_color, 2, cv2.LINE_AA
                        )
                        y_line += 22

                    # แสดงเวลา Closed ต่อเนื่อง (ถ้ายังไม่ถึง 3 วิ)
                    if 0.0 < sleep_elapsed < sleep_threshold_sec:
                        remain = max(0.0, sleep_threshold_sec - sleep_elapsed)
                        tip = f"Sleeping in {remain:.1f}s"
                        cv2.putText(
                            frame, tip,
                            (left, min(y_line, bottom - 8)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 215, 255), 2, cv2.LINE_AA
                        )

                # 3) อัปเดตภาพรวม (เผื่อไม่มีใบหน้า)
                if faces_info:
                    main_label = faces_info[0]["display_label"]
                    main_conf  = faces_info[0]["confidence"]
                    main_names = [fi["name"] for fi in faces_info]
                else:
                    try:
                        main_label, main_conf, _ = predict_from_eyes(frame)
                    except Exception:
                        main_label, main_conf = "Unknown", 0.0
                    main_names = []

                    # เดินเวลาในระดับภาพรวม
                    now = time.time()
                    if main_label.lower() == "closed":
                        if sleep_start_time is None:
                            sleep_start_time = now
                        elif now - sleep_start_time >= sleep_threshold_sec:
                            main_label = "Sleep"
                    else:
                        sleep_start_time = None

                # snapshot เมื่อมีคนหลับ (display_label == Sleep)
                snapshot_b64 = None
                if any(fi["display_label"].lower() == "sleep" for fi in faces_info):
                    ok2, buf2 = cv2.imencode(".jpg", frame)
                    if ok2:
                        snapshot_b64 = "data:image/jpeg;base64," + base64.b64encode(buf2).decode("utf-8")

                latest_status = {
                    "label": main_label,
                    "confidence": float(main_conf),
                    "faces": main_names,        # คงรูปแบบเดิม
                    "faces_info": faces_info,   # รายละเอียดรายคน (มี display_label, sleep_elapsed)
                    "per_eye": [],              # คง field เดิมไว้ให้ย้อนหลัง
                    "timestamp": time.time(),
                    "snapshot": snapshot_b64
                }

                # 4) ส่งเฟรมเป็น MJPEG
                ok, buf = cv2.imencode(".jpg", frame)
                if not ok:
                    await asyncio.sleep(0.01)
                    continue

                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n"
                )
                await asyncio.sleep(0.01)
        finally:
            await _close_camera(cap)

    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Connection": "keep-alive",
    }
    return StreamingResponse(
        gen(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers=headers,
    )


# ===== ROOT =====
@app.get("/")
async def root():
    return {"message": "FastAPI Sleep Detection System is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
