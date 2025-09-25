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
courses_collection = db["courses"]

# ===== AI components =====
face_recognizer = FaceRecognizer()
sleep_detector = SleepDetector()

# ===== Stream state =====
is_streaming: bool = False
current_course_id: str | None = None  # Selected course for sleep detection
latest_status: Dict[str, Any] = {
    "label": None,
    "confidence": None,
    "faces": [],
    "per_eye": [],
    "timestamp": None,
    "snapshot": None,
}

# ---- เพิ่มตัวแปรตรวจหลับต่อเนื่อง ----
sleep_threshold_sec: float = 5.0          # ครบกี่วินาทีจึงถือว่า Sleep
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
    first_name: str
    last_name: str

class UserLogin(BaseModel):
    username: str
    password: str

class Behavior(BaseModel):
    student_id: str
    penalty: int
    created_at: datetime

class Course(BaseModel):
    course_name: str
    sleeping_students: List[str] = []  # List of user_ids who sleep in this course
    created_at: datetime = None
    updated_at: datetime = None

class CourseSelectionData(BaseModel):
    course_id: str = None  # Allow None to deselect
    
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
        "first_name": user.get("first_name", ""),
        "last_name": user.get("last_name", ""),
    }

def serialize_behavior(behavior):
    return {
        "id": str(behavior["_id"]),
        "student_id": behavior["student_id"],
        "penalty": behavior["penalty"],
        "created_at": behavior["created_at"],
        "status": behavior.get("status", "active"),
    }

def serialize_course(course):
    return {
        "_id": str(course["_id"]),
        "course_name": course["course_name"],
        "sleeping_students": course.get("sleeping_students", []),
        "created_at": course.get("created_at"),
        "updated_at": course.get("updated_at"),
    }

def _clip(v, lo, hi):
    return max(lo, min(int(v), hi))

def get_user_display_name(user_id: str) -> str:
    """Get user's display name from database."""
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if user:
            first_name = user.get("first_name", "").strip()
            last_name = user.get("last_name", "").strip()
            if first_name and last_name:
                return f"{first_name} {last_name}"
            elif first_name:
                return first_name
            elif user.get("username"):
                return user["username"]
        return user_id
    except:
        return user_id


def extract_eye_crops(frame_bgr) -> List[np.ndarray]:
    """ คืนลิสต์รูปตา [left, right] จากเฟรม ถ้าไม่เจอ คืน [] """
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
    รวมผลจากตาซ้าย/ขวา สู่ (label, conf, per_eye)
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
    course_id: str = None  # Optional course ID
    
class DeleteSleepData(BaseModel):
    name: str

class CourseStudentData(BaseModel):
    user_id: str

# Store recent sleep detection history (for real-time dashboard updates)
recent_sleep_detections: List = []

@app.get('/who-sleeping')
async def get_who_sleeping(course_id: str = None):
    """
    Get sleeping students from courses or recent detections.
    If course_id is provided, get sleeping students from that specific course.
    Otherwise, get recent sleep detections across all courses.
    """
    if course_id:
        try:
            # Get sleeping students from specific course
            course = courses_collection.find_one({"_id": ObjectId(course_id)})
            if not course:
                raise HTTPException(status_code=404, detail="Course not found")
            
            sleeping_students = []
            for user_id in course.get("sleeping_students", []):
                user = users_collection.find_one({"_id": ObjectId(user_id)})
                if user:
                    display_name = get_user_display_name(user_id)
                    sleeping_students.append({
                        "user_id": user_id,
                        "name": display_name,
                        "username": user.get("username", ""),
                        "added_to_course": course.get("updated_at", "")
                    })
            
            return {"course_id": course_id, "course_name": course["course_name"], "sleeping_students": sleeping_students}
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error fetching course sleeping students: {str(e)}")
    else:
        # Return recent sleep detections for real-time dashboard
        return {"recent_detections": recent_sleep_detections}

@app.get('/who-sleeping/current-course')
async def get_who_sleeping_current_course():
    """Get sleeping students from the currently selected course for detection."""
    global current_course_id
    if not current_course_id:
        return {"message": "No course selected for detection", "sleeping_students": []}
    
    return await get_who_sleeping(current_course_id)

@app.delete('/who-sleeping')
async def delete_who_sleeping(data: DeleteSleepData):
    """Remove student from recent detections list."""
    global recent_sleep_detections
    recent_sleep_detections = [entry for entry in recent_sleep_detections if entry["name"] != data.name]
    return {"message": "Removed from recent detections", "recent_detections": recent_sleep_detections}

@app.delete('/who-sleeping/course/{course_id}/student/{user_id}')
async def remove_student_from_course_sleeping_list(course_id: str, user_id: str):
    """Remove a student from a specific course's sleeping students list."""
    try:
        course = courses_collection.find_one({"_id": ObjectId(course_id)})
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        
        # Remove user from sleeping_students
        result = courses_collection.update_one(
            {"_id": ObjectId(course_id)},
            {
                "$pull": {"sleeping_students": user_id},
                "$set": {"updated_at": datetime.now()}
            }
        )
        
        if result.modified_count > 0:
            user = users_collection.find_one({"_id": ObjectId(user_id)})
            display_name = get_user_display_name(user_id) if user else user_id
            return {"message": f"Removed {display_name} from course sleeping list"}
        else:
            return {"message": "Student was not in the course sleeping list"}
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error removing student: {str(e)}")

# ===== Course Student Management =====

@app.get('/courses/{course_id}/students')
async def get_course_students(course_id: str):
    """Get all students in a specific course."""
    try:
        course = courses_collection.find_one({"_id": ObjectId(course_id)})
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        
        students = []
        for user_id in course.get("sleeping_students", []):
            user = users_collection.find_one({"_id": ObjectId(user_id)})
            if user:
                students.append({
                    "user_id": str(user["_id"]),
                    "username": user.get("username", ""),
                    "first_name": user.get("first_name", ""),
                    "last_name": user.get("last_name", ""),
                    "email": user.get("email", ""),
                    "display_name": get_user_display_name(user_id)
                })
        
        return {
            "course_id": course_id,
            "course_name": course["course_name"],
            "students": students,
            "student_count": len(students)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error fetching course students: {str(e)}")

@app.post('/courses/{course_id}/students')
async def add_student_to_course(course_id: str, data: CourseStudentData):
    """Add a student to a specific course."""
    try:
        # Check if course exists
        course = courses_collection.find_one({"_id": ObjectId(course_id)})
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        
        # Check if user exists
        user = users_collection.find_one({"_id": ObjectId(data.user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if student is already in the course
        if data.user_id in course.get("sleeping_students", []):
            raise HTTPException(status_code=400, detail="Student is already in this course")
        
        # Add student to course
        result = courses_collection.update_one(
            {"_id": ObjectId(course_id)},
            {
                "$addToSet": {"sleeping_students": data.user_id},
                "$set": {"updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Failed to add student to course")
        
        return {
            "message": "Student added to course successfully",
            "course_id": course_id,
            "user_id": data.user_id,
            "display_name": get_user_display_name(data.user_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error adding student to course: {str(e)}")

@app.delete('/courses/{course_id}/students/{user_id}')
async def remove_student_from_course_manual(course_id: str, user_id: str):
    """Remove a student from a specific course (manual removal by admin)."""
    try:
        # Check if course exists
        course = courses_collection.find_one({"_id": ObjectId(course_id)})
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        
        # Check if user exists
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Remove student from course
        result = courses_collection.update_one(
            {"_id": ObjectId(course_id)},
            {
                "$pull": {"sleeping_students": user_id},
                "$set": {"updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Student not found in this course")
        
        return {
            "message": "Student removed from course successfully",
            "course_id": course_id,
            "user_id": user_id,
            "display_name": get_user_display_name(user_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error removing student from course: {str(e)}")

@app.get('/users/available')
async def get_available_users():
    """Get all users that can be added to courses."""
    try:
        users = list(users_collection.find({}))
        user_list = []
        
        for user in users:
            user_list.append({
                "user_id": str(user["_id"]),
                "username": user.get("username", ""),
                "first_name": user.get("first_name", ""),
                "last_name": user.get("last_name", ""),
                "email": user.get("email", ""),
                "display_name": get_user_display_name(str(user["_id"]))
            })
        
        return {
            "users": user_list,
            "user_count": len(user_list)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error fetching users: {str(e)}")

@app.post('/who-sleeping')
async def post_who_sleeping(data: WhoSleepData):
    """Add detected sleeping student to course and recent detections."""
    global recent_sleep_detections
    
    # Add to recent detections list (for real-time dashboard)
    detection_entry = {"name": data.name, "time": data.time}
    recent_sleep_detections.append(detection_entry)
    if len(recent_sleep_detections) > 10:  # Keep last 10 detections
        recent_sleep_detections = recent_sleep_detections[-10:]
    
    # If course_id is provided, add the student to the course's sleeping_students list
    if data.course_id:
        try:
            # Find user by display name (reverse lookup user_id)
            name_parts = data.name.split(' ', 1)
            if len(name_parts) == 2:
                first_name, last_name = name_parts
                user = users_collection.find_one({
                    "first_name": {"$regex": f"^{first_name}$", "$options": "i"},
                    "last_name": {"$regex": f"^{last_name}$", "$options": "i"}
                })
            else:
                # Try to find by username or first_name only
                user = users_collection.find_one({
                    "$or": [
                        {"username": {"$regex": f"^{data.name}$", "$options": "i"}},
                        {"first_name": {"$regex": f"^{data.name}$", "$options": "i"}}
                    ]
                })
            
            if user:
                user_id = str(user["_id"])
                # Add user to course's sleeping_students list
                result = courses_collection.update_one(
                    {"_id": ObjectId(data.course_id)},
                    {
                        "$addToSet": {"sleeping_students": user_id},
                        "$set": {"updated_at": datetime.now()}
                    }
                )
                print(f"Added user {data.name} (ID: {user_id}) to course {data.course_id} sleeping list")
                
                # Get updated course info for response
                course = courses_collection.find_one({"_id": ObjectId(data.course_id)})
                return {
                    "message": "Added to course sleeping list", 
                    "course_name": course["course_name"] if course else "Unknown",
                    "student_name": data.name,
                    "recent_detections": recent_sleep_detections
                }
            else:
                print(f"Could not find user with name: {data.name}")
                return {
                    "message": "Added to recent detections only (user not found in database)", 
                    "recent_detections": recent_sleep_detections
                }
                
        except Exception as e:
            print(f"Error adding student to course: {str(e)}")
            return {
                "message": f"Error adding to course: {str(e)}", 
                "recent_detections": recent_sleep_detections
            }
    else:
        return {
            "message": "Added to recent detections (no course selected)", 
            "recent_detections": recent_sleep_detections
        }

@app.post("/signup")
async def signup(user: User):
    if users_collection.find_one({"email": user.email}) or users_collection.find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="Username or email already exists")
    result = users_collection.insert_one(user.dict())
    return {
        "message": "User registered successfully",
        "user_id": str(result.inserted_id)
    }

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
        "first_name": found.get("first_name", ""),
        "last_name": found.get("last_name", ""),
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
        "first_name": user.get("first_name", ""),
        "last_name": user.get("last_name", ""),
    }

@app.put("/users/{user_id}")
async def update_user(user_id: str, user: User):
    result = users_collection.update_one({"_id": ObjectId(user_id)}, {"$set": user.dict()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User updated successfully"}

@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str):
    # First verify the user exists before deletion
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete the user from database
    result = users_collection.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete associated profile image if it exists
    # Check for common image extensions that might be used for this user
    for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff']:
        image_path = f"static/{user_id}{ext}"
        if os.path.exists(image_path):
            try:
                os.remove(image_path)
                print(f"Deleted profile image: {image_path}")
            except Exception as e:
                print(f"Warning: Could not delete image {image_path}: {str(e)}")
                # Continue with user deletion even if image deletion fails

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

# ===== Course Management =====

@app.get("/courses")
async def get_courses():
    courses = courses_collection.find()
    return [serialize_course(c) for c in courses]

@app.get("/courses/{course_id}")
async def get_course(course_id: str):
    course = courses_collection.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return serialize_course(course)

@app.post("/courses")
async def create_course(course: Course):
    course_data = course.dict()
    course_data["created_at"] = datetime.now()
    course_data["updated_at"] = datetime.now()
    
    result = courses_collection.insert_one(course_data)
    new_course = courses_collection.find_one({"_id": result.inserted_id})
    return serialize_course(new_course)

@app.put("/courses/{course_id}")
async def update_course(course_id: str, course: Course):
    course_data = course.dict()
    course_data["updated_at"] = datetime.now()
    
    result = courses_collection.update_one(
        {"_id": ObjectId(course_id)}, 
        {"$set": course_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Course not found")
    
    updated_course = courses_collection.find_one({"_id": ObjectId(course_id)})
    return serialize_course(updated_course)

@app.delete("/courses/{course_id}")
async def delete_course(course_id: str):
    result = courses_collection.delete_one({"_id": ObjectId(course_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Course not found")
    return {"message": "Course deleted successfully"}

@app.post("/courses/{course_id}/add-sleeping-student/{user_id}")
async def add_sleeping_student_to_course(course_id: str, user_id: str):
    # Verify course exists
    course = courses_collection.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Verify user exists
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Add user to sleeping_students if not already there
    result = courses_collection.update_one(
        {"_id": ObjectId(course_id)},
        {"$addToSet": {"sleeping_students": user_id}, "$set": {"updated_at": datetime.now()}}
    )
    
    updated_course = courses_collection.find_one({"_id": ObjectId(course_id)})
    return serialize_course(updated_course)

@app.delete("/courses/{course_id}/remove-sleeping-student/{user_id}")
async def remove_sleeping_student_from_course(course_id: str, user_id: str):
    # Verify course exists
    course = courses_collection.find_one({"_id": ObjectId(course_id)})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Remove user from sleeping_students
    result = courses_collection.update_one(
        {"_id": ObjectId(course_id)},
        {"$pull": {"sleeping_students": user_id}, "$set": {"updated_at": datetime.now()}}
    )
    
    updated_course = courses_collection.find_one({"_id": ObjectId(course_id)})
    return serialize_course(updated_course)

@app.post("/upload-profile-image/{user_id}")
async def upload_profile_image(user_id: str, file: UploadFile = File(...)):
    try:
        # Verify user exists
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get file extension from original filename
        original_name = file.filename.lower().strip()
        file_extension = os.path.splitext(original_name)[1]
        
        # Use user_id as filename with original extension
        new_filename = f"{user_id}{file_extension}"
        path = f"static/{new_filename}"
        
        # Remove any existing profile images for this user
        # Check for common image extensions
        for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            old_path = f"static/{user_id}{ext}"
            if os.path.exists(old_path):
                os.remove(old_path)
        
        # Save the new file
        with open(path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Update user's profileImage field in database
        users_collection.update_one(
            {"_id": ObjectId(user_id)}, 
            {"$set": {"profileImage": f"http://localhost:8000/static/{new_filename}"}}
        )
        
        return {"image_url": f"http://localhost:8000/static/{new_filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

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

        # Convert user_ids to display names for the response
        recognized_faces = []
        for (t, r, b, l), n in zip(face_locations, names):
            display_name = n
            if n and n not in ["Unknown", "Error"]:
                display_name = get_user_display_name(n)
            recognized_faces.append({
                "name": n,                  # original user_id
                "display_name": display_name,  # actual first_name + last_name
                "box": (l, t, r, b)
            })

        # Extract just the display names for faces array
        faces = [face["display_name"] for face in recognized_faces if face["display_name"]]
        
        # ตรวจสอบและบันทึกการหลับถ้ามีการเลือกคอร์ส
        if label == "Sleep" and current_course_id and faces:
            for face_name in faces:
                # หา user_id จาก display name
                matching_face = next((f for f in recognized_faces if f["display_name"] == face_name), None)
                if matching_face and matching_face["name"] not in ["Unknown", "Error"]:
                    user_id = matching_face["name"]
                    add_sleeping_student_to_course(current_course_id, user_id)
        
        result = {
            "status": "Frame processed",
            "label": label,
            "confidence": conf,
            "faces": faces,
            "per_eye": per_eye,
            "recognized_faces": recognized_faces,
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
    return JSONResponse({
        "is_streaming": is_streaming, 
        "status": latest_status,
        "current_course_id": current_course_id
    })

@app.post("/set_course_for_detection")
async def set_course_for_detection(data: CourseSelectionData):
    global current_course_id
    current_course_id = data.course_id
    if current_course_id:
        # Verify course exists
        course = courses_collection.find_one({"_id": ObjectId(current_course_id)})
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        return {"message": f"Course set for sleep detection", "course_id": current_course_id}
    else:
        return {"message": "Course selection cleared", "course_id": None}

@app.get("/get_current_course")
async def get_current_course():
    if current_course_id:
        course = courses_collection.find_one({"_id": ObjectId(current_course_id)})
        if course:
            return {"course": serialize_course(course)}
        else:
            return {"course": None}
    else:
        return {"course": None}

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

                # 2) ตรวจตา "รายคน" แล้ววาดผลไว้ตรงหน้าคนนั้น
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

                    # Convert user_id to display name (first_name + last_name)
                    display_name = name
                    if name and name != "Unknown" and name != "Error":
                        display_name = get_user_display_name(name)

                    # ---- นับเวลาต่อเนื่องรายบุคคล ----
                    now = time.time()
                    key = display_name if display_name else "Unknown"
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
                                        sleep_data = {
                                            "name": key, 
                                            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                            "course_id": current_course_id  # Pass the selected course ID
                                        }
                                        await client.post(
                                            "http://localhost:8000/who-sleeping",
                                            json=sleep_data
                                        )
                                    except Exception:
                                        pass
                                
                    else:
                        # เปิดตา - รีเซ็ตตัวนับ
                        sleep_timers[key] = None

                    faces_info.append({
                        "name": name,                   # original user_id from face recognition
                        "display_name": display_name,   # actual first_name + last_name
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
                    head = f"{display_name} | {display_label} ({conf:.0f}%)"
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

                    # แสดงเวลา Closed ต่อเนื่อง (ถ้ายังไม่ถึง 5 วิ)
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

# ===== New Frame Processing Endpoint =====

def is_user_in_course(user_id: str, course_id: str) -> bool:
    """Check if user is a member of the selected course."""
    if not course_id:
        return False
    try:
        course = courses_collection.find_one({"_id": ObjectId(course_id)})
        if course:
            return user_id in course.get("sleeping_students", [])
        return False
    except:
        return False

@app.post("/get_processed_frame")
async def get_processed_frame(frame_data: FrameData):
    """Process a single frame sent from frontend with sleep detection, face recognition, and draw all detection boxes."""
    global is_streaming, latest_status, sleep_start_time, sleep_timers, current_course_id
    
    if not is_streaming:
        raise HTTPException(status_code=400, detail="Stream not started")

    try:
        # Decode base64 image from frontend
        if not frame_data.image.startswith('data:image'):
            raise HTTPException(status_code=400, detail="Invalid base64 format")
        
        img_data = base64.b64decode(frame_data.image.split(',')[1])
        img = Image.open(BytesIO(img_data))
        frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

        # Check course membership for filtering
        show_warning = False
        warning_message = ""
        
        if not current_course_id:
            show_warning = True
            warning_message = "Please select a course first"

        # 1) Find faces + names
        try:
            face_locations, names = face_recognizer.recognize_faces(frame)
        except Exception:
            face_locations, names = [], []

        # Filter faces by course membership if course is selected
        filtered_faces = []
        filtered_names = []
        
        if current_course_id:
            course_members_detected = False
            for (face_loc, name) in zip(face_locations, names):
                if name and name not in ["Unknown", "Error"]:
                    if is_user_in_course(name, current_course_id):
                        filtered_faces.append(face_loc)
                        filtered_names.append(name)
                        course_members_detected = True
                else:
                    # Include unknown faces but don't count them as course members
                    filtered_faces.append(face_loc)
                    filtered_names.append(name)
            
            if not course_members_detected and face_locations:
                show_warning = True
                warning_message = "No course members detected"
                
            face_locations = filtered_faces
            names = filtered_names

        faces_info = []  # Store results per person

        # 2) Process each detected face and draw detection boxes
        for (top, right, bottom, left), name in zip(face_locations, names):
            # Prevent index out of bounds
            top = max(0, top)
            left = max(0, left)
            bottom = min(frame.shape[0]-1, bottom)
            right = min(frame.shape[1]-1, right)

            face_crop = frame[top:bottom, left:right].copy()
            try:
                label, conf, per_eye = predict_from_eyes(face_crop)
            except Exception:
                label, conf, per_eye = "Unknown", 0.0, []

            # Convert user_id to display name (first_name + last_name)
            display_name = name
            if name and name != "Unknown" and name != "Error":
                display_name = get_user_display_name(name)

            # ---- Count continuous time per person ----
            now = time.time()
            key = display_name if display_name else "Unknown"
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
                        display_label = "Sleep"  # Change label when threshold reached
                        # Send sleep notification
                        async with httpx.AsyncClient() as client:
                            try:
                                print(f"📢 Alert {key} is sleeping")
                                sleep_data = {
                                    "name": key, 
                                    "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                    "course_id": current_course_id
                                }
                                await client.post(
                                    "http://localhost:8000/who-sleeping",
                                    json=sleep_data
                                )
                            except Exception:
                                pass
            else:
                # Eyes open - reset timer
                sleep_timers[key] = None

            faces_info.append({
                "name": name,                   # original user_id from face recognition
                "display_name": display_name,   # actual first_name + last_name
                "label": label,                 # label from model
                "display_label": display_label, # label to show (Sleep/Closed/Open)
                "sleep_elapsed": round(sleep_elapsed, 2),
                "confidence": float(conf),
                "box": [int(left), int(top), int(right), int(bottom)],
                "per_eye": per_eye
            })

            # ===== DRAW ALL DETECTION BOXES AND DETAILS ON THE FRAME =====
            
            # Box/text background colors based on detection state
            is_sleep = (display_label.lower() == "sleep")
            is_closed = (display_label.lower() == "closed")
            if is_sleep:
                box_color = (0, 0, 255)     # Red: Sleep
            elif is_closed:
                box_color = (40, 40, 220)   # Dark blue: Closed (counting time)
            else:
                box_color = (36, 255, 12)   # Green: Open/others
            txt_color = (255, 255, 255)

            # Draw main face bounding box
            cv2.rectangle(frame, (left, top), (right, bottom), box_color, 3)

            # Header bar: name | status (%)
            head = f"{display_name} | {display_label} ({conf:.0f}%)"
            (tw, th), _ = cv2.getTextSize(head, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
            pad = 8
            y_text = max(0, top - th - 15)
            
            # Draw header background
            cv2.rectangle(
                frame,
                (left, y_text - pad),
                (left + tw + pad*2, y_text + th + pad),
                box_color, -1
            )
            
            # Draw header text
            cv2.putText(
                frame, head,
                (left + pad, y_text + th),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, txt_color, 2, cv2.LINE_AA
            )

            # Per-eye details below header
            y_line = y_text + th + pad + 25
            for e in (per_eye or []):
                eye_line = f"{e['eye']}: {e['label']} ({e['conf']:.0f}%)"
                cv2.putText(
                    frame, eye_line,
                    (left, min(y_line, bottom - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, box_color, 2, cv2.LINE_AA
                )
                y_line += 25

            # Show sleep countdown timer (if counting down to sleep)
            if 0.0 < sleep_elapsed < sleep_threshold_sec:
                remain = max(0.0, sleep_threshold_sec - sleep_elapsed)
                countdown_text = f"Sleep in {remain:.1f}s"
                cv2.putText(
                    frame, countdown_text,
                    (left, min(y_line, bottom - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 215, 255), 2, cv2.LINE_AA
                )
                y_line += 25

            # Draw status indicator circle on top-right of face box
            indicator_x = right - 25
            indicator_y = top + 25
            if indicator_x > left and indicator_y < bottom:
                # Draw circle background
                cv2.circle(frame, (indicator_x, indicator_y), 15, (0, 0, 0), -1)  # Black background
                cv2.circle(frame, (indicator_x, indicator_y), 13, box_color, -1)   # Colored fill
                cv2.circle(frame, (indicator_x, indicator_y), 15, box_color, 2)    # Colored border
                
                # Draw status symbol
                if is_sleep:
                    # Draw sleep symbol (zzz)
                    cv2.putText(frame, "Z", (indicator_x - 8, indicator_y + 6), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.8, txt_color, 2, cv2.LINE_AA)
                elif is_closed:
                    # Draw closed eye symbol
                    cv2.putText(frame, "-", (indicator_x - 8, indicator_y + 6), 
                               cv2.FONT_HERSHEY_SIMPLEX, 1.2, txt_color, 3, cv2.LINE_AA)
                else:
                    # Draw open eye symbol
                    cv2.putText(frame, "O", (indicator_x - 8, indicator_y + 6), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.8, txt_color, 2, cv2.LINE_AA)

        # Add warning message overlay if needed
        if show_warning and warning_message:
            # Create semi-transparent overlay at bottom
            h, w = frame.shape[:2]
            overlay = frame.copy()
            cv2.rectangle(overlay, (20, h-100), (w-20, h-20), (0, 0, 0), -1)
            cv2.addWeighted(overlay, 0.8, frame, 0.2, 0, frame)
            
            # Add warning text
            cv2.putText(frame, warning_message, (30, h-50), 
                       cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 255), 3, cv2.LINE_AA)

        # Add system status overlay at top-left
        status_text = f"Faces: {len(faces_info)} | Course: {'Selected' if current_course_id else 'None'}"
        cv2.putText(frame, status_text, (20, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
        
        # Add background for status text
        (status_w, status_h), _ = cv2.getTextSize(status_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
        cv2.rectangle(frame, (15, 5), (25 + status_w, 35 + status_h), (0, 0, 0), -1)
        cv2.putText(frame, status_text, (20, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)

        # 3) Update overall status (in case no faces)
        if faces_info:
            main_label = faces_info[0]["display_label"]
            main_conf = faces_info[0]["confidence"]
            main_names = [fi["display_name"] for fi in faces_info if fi["display_name"]]
        else:
            try:
                main_label, main_conf, _ = predict_from_eyes(frame)
            except Exception:
                main_label, main_conf = "Unknown", 0.0
            main_names = []

            # Run time at overall level
            now = time.time()
            if main_label.lower() == "closed":
                if sleep_start_time is None:
                    sleep_start_time = now
                elif now - sleep_start_time >= sleep_threshold_sec:
                    main_label = "Sleep"
            else:
                sleep_start_time = None

        # Update latest status
        latest_status = {
            "label": main_label,
            "confidence": float(main_conf),
            "faces": main_names,
            "faces_info": faces_info,
            "per_eye": [],
            "timestamp": time.time(),
            "snapshot": None
        }

        # 4) Encode processed frame as JPEG and return
        ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not ok:
            raise HTTPException(status_code=500, detail="Cannot encode processed frame")

        # Return processed frame as base64
        frame_b64 = base64.b64encode(buf).decode('utf-8')
        
        return {
            "frame": f"data:image/jpeg;base64,{frame_b64}",
            "status": latest_status,
            "timestamp": time.time()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing frame: {str(e)}")

# ===== Sleep history StudentDashborad.tsx =====

@app.get("/sleep-history/{username}")
async def get_sleep_history(username: str):
    history = [entry for entry in sleepingList if entry["name"] == username]
    return {"history": history}


# ===== ROOT =====
@app.get("/")
async def root():
    return {"message": "FastAPI Sleep Detection System is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
