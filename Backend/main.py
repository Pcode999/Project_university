from fastapi import FastAPI, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, EmailStr
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
from typing import Optional, List, Dict, Any
import shutil
import uuid
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
from face_recognizer import FaceRecognizer
from sleep_detector import SleepDetector

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # โปรดจำกัดโดเมนจริงในโปรดักชัน
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

client = MongoClient("mongodb://localhost:27017/")
db = client["Project_sleep_classroom"]
users_collection = db["users"]
behavior_collection = db["student_behavior_report"]

face_recognizer = FaceRecognizer()
sleep_detector = SleepDetector()

is_streaming: bool = False
latest_status: Dict[str, Any] = {
    "label": None,
    "confidence": None,
    "faces": [],
    "timestamp": None,
}

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

class BehaviorReport(BaseModel):
    id: str
    student_id: str
    penalty: int
    created_at: datetime
    status: str = "active"

def serialize_user(user):
    return {
        "_id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
        "password": user["password"],
        "profileImage": user["profileImage"],
        "role": user["role"]
    }

def serialize_behavior(behavior):
    return {
        "id": str(behavior["_id"]),
        "student_id": behavior["student_id"],
        "penalty": behavior["penalty"],
        "created_at": behavior["created_at"],
        "status": behavior.get("status", "active")
    }

# ===== USER ENDPOINTS =====
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
        "role": found["role"]
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
        "role": user["role"]
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

@app.get("/behavior-reports/{report_id}")
async def get_behavior_report(report_id: str):
    try:
        report = None
        if len(report_id) == 24:
            try:
                report = behavior_collection.find_one({"_id": ObjectId(report_id)})
            except Exception as e:
                print(f"ObjectId failed: {e}")
        if not report:
            report = behavior_collection.find_one({"_id": report_id})
        if not report:
            raise HTTPException(status_code=404, detail=f"Behavior report with ID '{report_id}' not found")
        return serialize_behavior(report)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_behavior_report: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/behavior-reports")
async def get_all_behavior_reports():
    reports = behavior_collection.find()
    return [serialize_behavior(report) for report in reports]

@app.get("/behavior-reports/student/{student_id}")
async def get_student_behavior_reports(student_id: str):
    reports = behavior_collection.find({"student_id": student_id})
    return [serialize_behavior(report) for report in reports]

@app.post("/behavior-reports")
async def create_behavior_report(behavior: Behavior):
    behavior_dict = behavior.dict()
    behavior_dict["created_at"] = datetime.now()
    behavior_dict["status"] = "active"
    result = behavior_collection.insert_one(behavior_dict)
    new_report = behavior_collection.find_one({"_id": result.inserted_id})
    return serialize_behavior(new_report)

@app.put("/behavior-reports/{report_id}")
async def update_behavior_report(report_id: str, behavior: Behavior):
    try:
        behavior_dict = behavior.dict()
        behavior_dict["updated_at"] = datetime.now()
        result = None
        if len(report_id) == 24:
            try:
                result = behavior_collection.update_one(
                    {"_id": ObjectId(report_id)},
                    {"$set": behavior_dict}
                )
            except:
                pass
        if not result or result.matched_count == 0:
            result = behavior_collection.update_one(
                {"_id": report_id},
                {"$set": behavior_dict}
            )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Behavior report not found")
        updated_report = behavior_collection.find_one({"_id": ObjectId(report_id) if len(report_id) == 24 else report_id})
        return serialize_behavior(updated_report)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in update_behavior_report: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.delete("/behavior-reports/{report_id}")
async def delete_behavior_report(report_id: str):
    try:
        result = None
        if len(report_id) == 24:
            try:
                result = behavior_collection.delete_one({"_id": ObjectId(report_id)})
            except:
                pass
        if not result or result.deleted_count == 0:
            result = behavior_collection.delete_one({"_id": report_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Behavior report not found")
        return {"message": "Behavior report deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in delete_behavior_report: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/create-mock-behavior")
async def create_mock_behavior():
    mock_id = "68652cfc6e6fa63eb354154c"
    behavior_collection.delete_many({"_id": mock_id})
    try:
        behavior_collection.delete_many({"_id": ObjectId(mock_id)})
    except:
        pass
    mock_data = {
        "_id": mock_id,
        "student_id": "student123",
        "penalty": 5,
        "created_at": datetime.now(),
        "status": "active"
    }
    behavior_collection.insert_one(mock_data)
    created_report = behavior_collection.find_one({"_id": mock_id})
    if not created_report:
        raise HTTPException(status_code=500, detail="Failed to create mock behavior report")
    return {
        "message": "Mock behavior report created successfully",
        "id": mock_id,
        "data": serialize_behavior(created_report)
    }

@app.get("/debug/behavior-reports")
async def debug_behavior_reports():
    reports = list(behavior_collection.find())
    debug_data = []
    for report in reports:
        debug_data.append({
            "raw_id": report["_id"],
            "id_type": type(report["_id"]).__name__,
            "student_id": report.get("student_id"),
            "penalty": report.get("penalty"),
            "created_at": report.get("created_at"),
            "status": report.get("status")
        })
    return {
        "total_reports": len(debug_data),
        "reports": debug_data
    }

@app.get("/debug/check-id/{report_id}")
async def debug_check_id(report_id: str):
    result = {
        "input_id": report_id,
        "id_length": len(report_id),
        "is_valid_objectid": False,
        "found_by_string": False,
        "found_by_objectid": False
    }
    try:
        ObjectId(report_id)
        result["is_valid_objectid"] = True
        if behavior_collection.find_one({"_id": ObjectId(report_id)}):
            result["found_by_objectid"] = True
    except:
        result["is_valid_objectid"] = False
    if behavior_collection.find_one({"_id": report_id}):
        result["found_by_string"] = True
    return result

@app.post("/upload-profile-image")
async def upload_profile_image(file: UploadFile = File(...)):
    try:
        name: str = file.filename.lower().strip()
        file_path = f"static/{name}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"image_url": f"http://localhost:8000/static/{name}"}
    except:
        raise HTTPException(status_code=500, detail="Upload failed")

@app.post("/process_frame")
async def process_frame(frame: FrameData):
    try:
        if not frame.image.startswith('data:image'):
            raise HTTPException(status_code=400, detail="Invalid base64 format")
        img_data = base64.b64decode(frame.image.split(',')[1])
        img = Image.open(BytesIO(img_data))
        img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

        detections = sleep_detector.plot_image_from_array(img)
        face_locations, names = face_recognizer.recognize_faces(img)

        result = {"status": "Frame processed", "detections": [], "recognized_faces": []}
        for det in detections:
            result["detections"].append({
                "ear": det["ear"],
                "status": det["status"],
                "box": det["box"]
            })
        for (top, right, bottom, left), name in zip(face_locations, names):
            result["recognized_faces"].append({"name": name, "box": (left, top, right, bottom)})
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error: {e}")

# --------- Streaming control & status ---------
@app.post("/start_stream")
async def start_stream():
    global is_streaming
    is_streaming = True
    return {"message": "Video stream started", "status": "success"}

@app.post("/stop_stream")
async def stop_stream():
    global is_streaming
    is_streaming = False
    return {"message": "Video stream stopped", "status": "success"}

@app.get("/stream_status")
async def get_stream_status():
    return JSONResponse({
        "is_streaming": is_streaming,
        "status": latest_status
    })

BOUNDARY = "frame"

def _multipart_chunk(img_bytes: bytes) -> bytes:
    # Note the exact CRLFs and boundary
    head = (
        f"--{BOUNDARY}\r\n"
        "Content-Type: image/jpeg\r\n"
        f"Content-Length: {len(img_bytes)}\r\n\r\n"
    ).encode("utf-8")
    tail = b"\r\n"
    return head + img_bytes + tail

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

def generate_frames():
    global is_streaming, latest_status

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        is_streaming = False
        raise HTTPException(status_code=500, detail="Cannot open camera")

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    try:
        while is_streaming:
            success, frame = cap.read()
            if not success:
                break

            frame = cv2.flip(frame, 1)

            # Face recognition
            face_locations, names = face_recognizer.recognize_faces(frame)

            # Sleep detection
            label, conf = sleep_detector.predict_from_array(frame)

            # อัปเดตสถานะล่าสุดให้ frontend โพลล์ไปแสดง
            latest_status = {
                "label": label,
                "confidence": float(conf) if conf is not None else None,
                "faces": names or [],
                "timestamp": time.time(),
            }

            # (เลือก) วาด overlay บนภาพ
            try:
                text = f"{label} ({latest_status['confidence']:.2f})"
            except Exception:
                text = f"{label}"
            cv2.putText(frame, text, (12, 28),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (50, 220, 50), 2, cv2.LINE_AA)
            y0 = 60
            for nm in names or []:
                cv2.putText(frame, nm, (12, y0),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (220, 220, 50), 2, cv2.LINE_AA)
                y0 += 28

            ok, buffer = cv2.imencode('.jpg', frame)
            if not ok:
                continue
            frame_bytes = buffer.tobytes()
            print(latest_status)

            # ส่ง multipart chunk
            yield _multipart_chunk(frame_bytes)
    finally:
        cap.release()

@app.get("/video_feed")
async def video_feed(request: Request):
    global is_streaming, latest_status

    if not is_streaming:
        raise HTTPException(status_code=400, detail="Stream not started")

    cap = await _open_camera()

    async def gen():
        nonlocal cap
        try:
            while is_streaming:
                # Stop if client went away
                if await request.is_disconnected():
                    break

                ok, frame = cap.read()
                if not ok:
                    # small backoff and retry instead of crashing the stream immediately
                    await asyncio.sleep(0.02)
                    continue

                frame = cv2.flip(frame, 1)

                # Run your detectors (wrap in try so errors don't kill the stream)
                try:
                    face_locations, names = face_recognizer.recognize_faces(frame)
                except Exception:
                    face_locations, names = [], []

                try:
                    label, conf = sleep_detector.predict_from_array(frame)
                except Exception:
                    label, conf = "Unknown", 0.0

                # Update latest_status for /stream_status
                latest_status = {
                    "label": label,
                    "confidence": float(conf) if conf is not None else None,
                    "faces": names or [],
                    "timestamp": time.time(),
                }
                
                print(latest_status)

                # (optional) draw overlay
                try:
                    cv2.putText(
                        frame,
                        f"{label} ({latest_status['confidence']:.2f})",
                        (12, 28),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.8,
                        (50, 220, 50),
                        2,
                        cv2.LINE_AA,
                    )
                    cv2.putText(
                        frame,
                        f"Faces: {names[0] if names else 'None'}",
                        (12, 60 + i * 28),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.7,
                        (220, 220, 50),
                        2,
                        cv2.LINE_AA,
                    )
                except Exception:
                    pass

                ok, buf = cv2.imencode(".jpg", frame)
                if not ok:
                    # skip this frame; don't crash the stream
                    await asyncio.sleep(0.01)
                    continue

                yield _multipart_chunk(buf.tobytes())

                # tiny sleep so we don’t hog the loop (helps stability)
                await asyncio.sleep(0.01)
        finally:
            await _close_camera(cap)

    # Important extra headers for streaming over HTTP/1.1
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Connection": "keep-alive",
    }

    return StreamingResponse(
        gen(),
        media_type=f"multipart/x-mixed-replace; boundary={BOUNDARY}",
        headers=headers,
    )

# ===== ROOT ENDPOINT =====
@app.get("/")
async def root():
    return {"message": "FastAPI Sleep Detection System is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
