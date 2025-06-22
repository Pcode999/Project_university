from fastapi import FastAPI, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
import shutil
import uuid
import os

app = FastAPI()

client = MongoClient("mongodb://localhost:27017/")
db = client["Project_sleep_classroom"]
users_collection = db["users"]
behavior_collection = db["student_behavior_report"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

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
    subject: str
    penalty: int

def serialize_user(user):
    return {
        "_id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
        "password": user["password"],
        "profileImage": user["profileImage"],
        "role": user["role"]
    }

@app.get("/users")
async def get_users():
    users = users_collection.find()
    return [serialize_user(user) for user in users]

@app.get("/search-students")
async def search_students(name: str = ""):
    query = {
        "role": "student",
        "username": {"$regex": name, "$options": "i"}
    }
    results = users_collection.find(query)
    return [serialize_user(u) for u in results]

@app.get("/student/{username}")
async def get_student_by_username(username: str):
    user = users_collection.find_one({"username": username, "role": "student"})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "_id": str(user["_id"]),  # ✅ ต้องใช้ "_id"
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

@app.post("/signup")
async def signup(user: User):
    if users_collection.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    if users_collection.find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="Username already exists")
    users_collection.insert_one(user.dict())
    return {"message": "User registered successfully"}

@app.post("/login")
async def login(user: UserLogin):
    found = users_collection.find_one({
        "username": user.username,
        "password": user.password
    })
    if found:
        return {
            "message": "Login successful",
            "id": str(found["_id"]),
            "username": found["username"],
            "email": found["email"],
            "profileImage": found["profileImage"],
            "role": found["role"]
        }
    raise HTTPException(status_code=401, detail="Invalid username or password")

@app.post("/upload-profile-image")
async def upload_profile_image(file: UploadFile = File(...)):
    try:
        ext = file.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{ext}"
        file_path = f"static/{filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        image_url = f"http://localhost:8000/static/{filename}"
        return {"image_url": image_url}
    except:
        raise HTTPException(status_code=500, detail="Upload failed")

@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str):
    result = users_collection.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

@app.post("/behavior-report")
async def save_behavior(data: Behavior):
    try:
        behavior_collection.insert_one({
            "student_id": ObjectId(data.student_id),
            "subject": data.subject,
            "penalty": data.penalty,
            "created_at": datetime.utcnow()
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
                "subject": r["subject"],
                "penalty": r["penalty"],
                "created_at": r.get("created_at", datetime.utcnow())
            }
            for r in reports
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))