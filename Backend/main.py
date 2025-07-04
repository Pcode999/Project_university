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

from face_recognizer import FaceRecognizer
from sleep_detector import MediaPipeSleepDetector  # ✅ ใช้ MediaPipe แทน

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
sleep_detector = MediaPipeSleepDetector()
is_streaming = False

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

        detections = sleep_detector.detect(img)
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

def generate_frames():
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    while is_streaming:
        success, frame = cap.read()
        if not success:
            break

        frame = cv2.flip(frame, 1)

        detections = sleep_detector.detect(frame)
        face_locations, names = face_recognizer.recognize_faces(frame)

        for det in detections:
            x1, y1, x2, y2 = det["box"]
            status = det["status"]
            color = det["color"]
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(frame, status, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        for (top, right, bottom, left), name in zip(face_locations, names):
            cv2.rectangle(frame, (left, top), (right, bottom), (255, 255, 0), 2)
            cv2.putText(frame, name, (left, top - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)

        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

    cap.release()

@app.get("/video_feed")
async def video_feed():
    global is_streaming
    if not is_streaming:
        raise HTTPException(status_code=400, detail="Stream not started")
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/stream_status")
async def get_stream_status():
    return {"is_streaming": is_streaming}
