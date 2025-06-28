import os
import cv2
import dlib
import numpy as np
import face_recognition
from imutils import face_utils
import time
import threading
from collections import deque

class OptimizedFaceSleepDetector:
    def __init__(self):
        self.known_face_encodings = []
        self.known_face_names = []
        self.detector = None
        self.predictor = None
        
        # สำหรับ multi-threading
        self.frame_queue = deque(maxlen=2)
        self.result_queue = deque(maxlen=2)
        self.processing = False
        
        # การปรับแต่งประสิทธิภาพ
        self.face_detection_scale = 0.3  # ลดขนาดภาพสำหรับตรวจจับใบหน้า
        self.process_every_n_frames = 1  # ประมวลผลทุก 2 เฟรม
        
    def load_known_faces(self, image_folder="images"):
        """โหลดภาพสำหรับการจดจำใบหน้า"""
        print("🔄 กำลังโหลดภาพที่รู้จัก...")
        
        if not os.path.exists(image_folder):
            print(f"❌ ไม่พบโฟลเดอร์ {image_folder}")
            return False
        
        # โหลดภาพแต่ละไฟล์
        loaded_count = 0
        for filename in os.listdir(image_folder):
            if filename.lower().endswith((".jpg", ".jpeg", ".png")):
                image_path = os.path.join(image_folder, filename)
                print(f"📷 กำลังโหลด: {filename}")
                
                try:
                    # โหลดและประมวลผลภาพ
                    image = face_recognition.load_image_file(image_path)
                    
                    # ลดขนาดภาพเพื่อเพิ่มความเร็ว
                    height, width = image.shape[:2]
                    if width > 800:
                        scale = 800 / width
                        new_width = int(width * scale)
                        new_height = int(height * scale)
                        image = cv2.resize(image, (new_width, new_height))
                    
                    # หาใบหน้าในภาพ
                    face_locations = face_recognition.face_locations(image, model="hog")
                    
                    if face_locations:
                        # ใช้ใบหน้าแรกที่พบ
                        face_encodings = face_recognition.face_encodings(image, face_locations)
                        if face_encodings:
                            self.known_face_encodings.append(face_encodings[0])
                            name = os.path.splitext(filename)[0]
                            self.known_face_names.append(name)
                            loaded_count += 1
                            print(f"✅ เพิ่ม {name} สำเร็จ")
                    else:
                        print(f"⚠️ ไม่พบใบหน้าในรูป {filename}")
                        
                except Exception as e:
                    print(f"❌ ข้อผิดพลาดกับ {filename}: {e}")
        
        print(f"📋 โหลดสำเร็จ: {loaded_count} คน")
        return loaded_count > 0
    
    def load_models(self, predictor_path="shape_predictor_68_face_landmarks.dat"):
        """โหลดโมเดล dlib"""
        print("🔄 กำลังโหลดโมเดล...")
        
        if not os.path.exists(predictor_path):
            print(f"❌ ไม่พบไฟล์ {predictor_path}")
            print("📥 ดาวน์โหลดได้จาก: http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2")
            return False
        
        try:
            self.detector = dlib.get_frontal_face_detector()
            self.predictor = dlib.shape_predictor(predictor_path)
            print("✅ โหลดโมเดลสำเร็จ")
            return True
        except Exception as e:
            print(f"❌ ข้อผิดพลาด: {e}")
            return False
    
    def calculate_ear(self, eye_points):
        """คำนวณ Eye Aspect Ratio"""
        # ระยะห่างแนวตั้ง
        A = np.linalg.norm(eye_points[1] - eye_points[5])
        B = np.linalg.norm(eye_points[2] - eye_points[4])
        
        # ระยะห่างแนวนอน
        C = np.linalg.norm(eye_points[0] - eye_points[3])
        
        # คำนวณ EAR
        ear = (A + B) / (2.0 * C)
        return ear
    
    def detect_drowsiness(self, landmarks):
        """ตรวจจับการง่วงนอน"""
        # ดึงจุดตาซ้ายและขวา
        left_eye = landmarks[36:42]
        right_eye = landmarks[42:48]
        
        # คำนวณ EAR สำหรับแต่ละตา
        left_ear = self.calculate_ear(left_eye)
        right_ear = self.calculate_ear(right_eye)
        
        # ใช้ค่าเฉลี่ย
        avg_ear = (left_ear + right_ear) / 2.0
        
        # กำหนดสถานะ
        if avg_ear > 0.25:
            return "ACTIVE", (0, 255, 0), left_eye, right_eye
        elif avg_ear > 0.20:
            return "DROWSY", (0, 165, 255), left_eye, right_eye
        else:
            return "SLEEPING", (0, 0, 255), left_eye, right_eye
    
    def process_frame_fast(self, frame):
        """ประมวลผลเฟรมแบบเร็ว"""
        try:
            # ลดขนาดภาพสำหรับการตรวจจับ
            small_frame = cv2.resize(frame, None, fx=self.face_detection_scale, fy=self.face_detection_scale)
            rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
            gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # ตรวจจับใบหน้า
            face_locations = face_recognition.face_locations(rgb_small_frame, model="hog")
            
            # ปรับขนาดตำแหน่งกลับมาขนาดเดิม
            face_locations = [(int(top/self.face_detection_scale), int(right/self.face_detection_scale), 
                             int(bottom/self.face_detection_scale), int(left/self.face_detection_scale))
                             for (top, right, bottom, left) in face_locations]
            
            results = []
            
            if face_locations:
                # ตรวจจับใบหน้าด้วย dlib
                dlib_faces = self.detector(gray_frame)
                
                for (top, right, bottom, left) in face_locations:
                    name = "Unknown"
                    status = "ACTIVE"
                    color = (0, 255, 0)
                    eye_points = []
                    
                    # จดจำใบหน้า
                    if self.known_face_encodings:
                        try:
                            face_encodings = face_recognition.face_encodings(
                                cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), 
                                [(top, right, bottom, left)]
                            )
                            
                            if face_encodings:
                                # เปรียบเทียบกับใบหน้าที่รู้จัก
                                distances = face_recognition.face_distance(self.known_face_encodings, face_encodings[0])
                                if len(distances) > 0:
                                    best_match_index = np.argmin(distances)
                                    if distances[best_match_index] < 0.5:  # เกณฑ์การจดจำ
                                        name = self.known_face_names[best_match_index]
                        except:
                            pass
                    
                    # ตรวจจับการง่วงนอน
                    for face in dlib_faces:
                        # ตรวจสอบว่าใบหน้า dlib ตรงกับ face_recognition หรือไม่
                        if abs(face.left() - left) < 100 and abs(face.top() - top) < 100:
                            try:
                                landmarks = self.predictor(gray_frame, face)
                                landmarks = face_utils.shape_to_np(landmarks)
                                
                                status, color, left_eye, right_eye = self.detect_drowsiness(landmarks)
                                eye_points = [left_eye, right_eye]
                                
                            except Exception as e:
                                print(f"⚠️ ข้อผิดพลาดในการตรวจจับตา: {e}")
                            break
                    
                    results.append({
                        'box': (left, top, right, bottom),
                        'name': name,
                        'status': status,
                        'color': color,
                        'eye_points': eye_points
                    })
            
            return results
            
        except Exception as e:
            print(f"❌ ข้อผิดพลาดในการประมวลผล: {e}")
            return []
    
    def draw_results(self, frame, results):
        """วาดผลลัพธ์บนเฟรม"""
        for result in results:
            left, top, right, bottom = result['box']
            name = result['name']
            status = result['status']
            color = result['color']
            eye_points = result['eye_points']
            
            # วาดกรอบใบหน้า
            cv2.rectangle(frame, (left, top), (right, bottom), color, 3)
            
            # วาดจุดตา
            for eye in eye_points:
                for (x, y) in eye:
                    cv2.circle(frame, (x, y), 2, (255, 255, 0), -1)
            
            # เตรียมข้อความ
            text = f"{name} - {status}"
            
            # วาดพื้นหลังข้อความ
            (text_width, text_height), baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.8, 2)
            cv2.rectangle(frame, (left, top - text_height - 10), 
                         (left + text_width + 10, top), color, -1)
            
            # วาดข้อความ
            cv2.putText(frame, text, (left + 5, top - 5), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        
        return frame
    
    def run(self):
        """รันการตรวจจับ"""
        print("🎥 เริ่มต้นกล้อง...")
        
        # เปิดกล้อง
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("❌ ไม่สามารถเปิดกล้องได้")
            return False
        
        # ตั้งค่ากล้อง
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # ลด buffer เพื่อลด lag
        
        frame_count = 0
        fps_counter = 0
        fps_start_time = time.time()
        current_fps = 0
        last_results = []
        
        print("🚀 เริ่มการตรวจจับ (กด 'q' เพื่อหยุด)")
        print("📌 Tips: ตรวจสอบให้แน่ใจว่ามีแสงเพียงพอและใบหน้าอยู่ในมุมมองกล้อง")
        
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    print("⚠️ ไม่สามารถอ่านเฟรมได้")
                    continue
                
                frame_count += 1
                fps_counter += 1
                frame = cv2.flip(frame, 1)  # พลิกแนวนอน
                
                # ประมวลผลทุก N เฟรม
                if frame_count % self.process_every_n_frames == 0:
                    results = self.process_frame_fast(frame)
                    if results:  # มีการตรวจพบใบหน้า
                        last_results = results
                
                # วาดผลลัพธ์
                if last_results:
                    frame = self.draw_results(frame, last_results)
                else:
                    # แสดงข้อความเมื่อไม่พบใบหน้า
                    cv2.putText(frame, "No Face Detected", (50, 100), 
                               cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                
                # คำนวณและแสดง FPS
                current_time = time.time()
                if current_time - fps_start_time >= 1.0:
                    current_fps = fps_counter
                    fps_counter = 0
                    fps_start_time = current_time
                
                cv2.putText(frame, f"FPS: {current_fps}", (10, 30), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
                
                # แสดงจำนวนใบหน้าที่รู้จัก
                if self.known_face_names:
                    cv2.putText(frame, f"Known: {len(self.known_face_names)} faces", (10, 60), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                
                cv2.imshow("Face & Sleep Detection", frame)
                
                # ตรวจสอบการกดปุ่ม
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q') or key == 27:
                    break
                
        except KeyboardInterrupt:
            print("\n🛑 หยุดการทำงานโดยผู้ใช้")
        except Exception as e:
            print(f"❌ ข้อผิดพลาด: {e}")
        finally:
            cap.release()
            cv2.destroyAllWindows()
            print("🏁 ปิดโปรแกรมเรียบร้อย")
        
        return True

def main():
    detector = OptimizedFaceSleepDetector()
    
    # โหลดโมเดล
    if not detector.load_models():
        print("❌ ไม่สามารถโหลดโมเดลได้")
        print("📥 กรุณาดาวน์โหลด shape_predictor_68_face_landmarks.dat")
        return
    
    # โหลดภาพที่รู้จัก (ถ้ามี)
    if os.path.exists("images"):
        detector.load_known_faces()
    else:
        print("📁 ไม่พบโฟลเดอร์ images - จะใช้งานแบบ Unknown เท่านั้น")
        print("💡 สร้างโฟลเดอร์ images และใส่รูปภาพเพื่อเปิดใช้การจดจำใบหน้า")
    
    # เริ่มการตรวจจับ
    detector.run()

if __name__ == "__main__":
    main()