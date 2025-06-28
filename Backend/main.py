from fastapi import FastAPI, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
from typing import Optional
import shutil
import uuid
import os
import base64
from PIL import Image
from io import BytesIO
import cv2
import numpy as np
import dlib
from imutils import face_utils

from SleepAndDetect import OptimizedFaceSleepDetector

app = FastAPI()

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# MongoDB
client = MongoClient("mongodb://localhost:27017/")
db = client["Project_sleep_classroom"]
users_collection = db["users"]
behavior_collection = db["student_behavior_report"]

# Initialize AI detector
face_detector = OptimizedFaceSleepDetector()
is_streaming = False

@app.on_event("startup")
async def startup_event():
    face_detector.load_models()
    face_detector.load_known_faces()

# Schemas
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

def serialize_user(user):
    return {
        "_id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
        "password": user["password"],
        "profileImage": user["profileImage"],
        "role": user["role"]
    }

# Video stream generator
def generate_frames():
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    while is_streaming:
        success, frame = cap.read()
        if not success:
            break

        frame = cv2.flip(frame, 1)
        results = face_detector.process_frame_fast(frame)
        frame = face_detector.draw_results(frame, results)

        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    cap.release()

@app.post("/signup")
async def signup(user: User):
    if users_collection.find_one({"email": user.email}) or users_collection.find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="Username or email already exists")
    users_collection.insert_one(user.dict())
    return {"message": "User registered successfully"}

@app.post("/login")
async def login(user: UserLogin):
    found = users_collection.find_one({
        "username": user.username,
        "password": user.password
    })
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
    results = users_collection.find({
        "role": "student",
        "username": {"$regex": name, "$options": "i"}
    })
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

@app.post("/upload-profile-image")
async def upload_profile_image(file: UploadFile = File(...)):
    try:
        ext = file.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{ext}"
        file_path = f"static/{filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"image_url": f"http://localhost:8000/static/{filename}"}
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
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_detector.detector(gray)

        count_sleep, count_drowsy, count_active = 0, 0, 0
        for face in faces:
            landmarks = face_utils.shape_to_np(face_detector.predictor(gray, face))
            left = face_detector.calculate_ear(landmarks[36:42])
            right = face_detector.calculate_ear(landmarks[42:48])
            ear = (left + right) / 2.0
            if ear > 0.25:
                count_active += 1
            elif ear > 0.20:
                count_drowsy += 1
            else:
                count_sleep += 1

        return {
            "status": "Frame processed",
            "sleeping_count": count_sleep,
            "drowsy_count": count_drowsy,
            "active_count": count_active
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error: {e}")

@app.post("/behavior-report")
async def save_behavior(data: Behavior):
    try:
        behavior_collection.insert_one({
            "student_id": ObjectId(data.student_id),
            "penalty": data.penalty,
            "created_at": data.created_at
        })
        return {"message": "Behavior report saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/behavior-report/{student_id}")
async def get_behavior_report(student_id: str):
    try:
        reports = behavior_collection.find({"student_id": ObjectId(student_id)})
        return [
            {
                "_id": str(r["_id"]),
                "penalty": r["penalty"],
                "created_at": r.get("created_at")
            }
            for r in reports
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

@app.get("/video_feed")
async def video_feed():
    global is_streaming
    if not is_streaming:
        raise HTTPException(status_code=400, detail="Stream not started")
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/stream_status")
async def get_stream_status():
    return {"is_streaming": is_streaming}


# หน้า main.py