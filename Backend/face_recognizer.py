import face_recognition 
import cv2 
import numpy as np 
import os 

class FaceRecognizer:
    def __init__(self, image_folder="static", min_faces=3):
        self.image_folder = image_folder
        self.min_faces = min_faces
        self.known_face_encodings = []
        self.known_face_names = []
        self.load_known_faces()
        
        # เพิ่ม frame_skip เพื่อลด delay (ประมวลผลทุก 3 เฟรม)
        self.frame_skip = 7
        self.frame_count = 0
        self.last_result = ([], [])
        
        # เพิ่มตัวแปรสำหรับปรับการประมวลผล
        self.process_scale = 0.25  # ลดขนาดเพิ่มเติม
        self.max_faces = 4         # จำกัดจำนวนหน้าที่ประมวลผล
    
    def load_known_faces(self):
        print("🔄 โหลดใบหน้าที่รู้จักจาก:", self.image_folder)
        
        if not os.path.exists(self.image_folder):
            os.makedirs(self.image_folder)
            return
        
        for filename in os.listdir(self.image_folder):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                try:
                    image_path = os.path.join(self.image_folder, filename)
                    image = face_recognition.load_image_file(image_path)
                    
                    height, width = image.shape[:2]
                    if width > 800:
                        scale = 800 / width
                        new_width = int(width * scale)
                        new_height = int(height * scale)
                        image = cv2.resize(image, (new_width, new_height))
                    
                    encoding = face_recognition.face_encodings(image)
                    if encoding:
                        self.known_face_encodings.append(encoding[0])
                        name = os.path.splitext(filename)[0]
                        self.known_face_names.append(name)
                        print(f"✅ โหลดใบหน้า: {name}")
                    else:
                        print(f"⚠️ ไม่สามารถเข้ารหัสใบหน้าในไฟล์: {filename}")
                        
                except Exception as e:
                    print(f"❌ ข้อผิดพลาดในไฟล์ {filename}: {str(e)}")
    
    def recognize_faces(self, frame):
        self.frame_count += 1
        
        if self.frame_count % self.frame_skip != 0:
            return self.last_result
        

        # ลดขนาดภาพมากขึ้นเพื่อเพิ่มความเร็ว
        small_frame = cv2.resize(frame, (0, 0), fx=self.process_scale, fy=self.process_scale)
        rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

        # ใช้ model ที่เร็วกว่าแต่แม่นยำกว่า (hog เร็วกว่า cnn)
        face_locations = face_recognition.face_locations(rgb_small_frame, model="hog")

        if len(face_locations) < self.min_faces:
            print(f"⚠️ ตรวจจับได้ {len(face_locations)} ใบหน้า (ต้องการอย่างน้อย {self.min_faces} ใบหน้า)")
        
        names = []
        if face_locations:
            try:

                # จำกัดจำนวนหน้าที่ประมวลผลเพื่อลด delay
                limited_locations = face_locations[:self.max_faces]
                face_encodings = face_recognition.face_encodings(rgb_small_frame, limited_locations)
                
                for face_encoding in face_encodings:
                    name = "Unknown"
                    
                    if self.known_face_encodings:  
                        # เพิ่ม tolerance เล็กน้อยเพื่อความเร็ว
                        matches = face_recognition.compare_faces(self.known_face_encodings, face_encoding, tolerance=0.5)
                        
                        if True in matches:
                            face_distances = face_recognition.face_distance(self.known_face_encodings, face_encoding)
                            best_match_index = np.argmin(face_distances)
                            if matches[best_match_index]:
                                name = self.known_face_names[best_match_index]
                    
                    names.append(name)
                    
            except Exception as e:
                print(f"❌ ข้อผิดพลาดในการประมวลผล face encodings: {e}")
                names = ["Error"] * len(face_locations)

        # ปรับ scale กลับตามขนาดที่ลดลง
        scale_factor = 1 / self.process_scale
        face_locations = [(int(top*scale_factor), int(right*scale_factor), int(bottom*scale_factor), int(left*scale_factor)) 
                         for (top, right, bottom, left) in face_locations]
        
        self.last_result = (face_locations, names)
        return face_locations, names

def main():

    recognizer = FaceRecognizer(image_folder="images", min_faces=1)  
    
    video_capture = cv2.VideoCapture(0)
    
    print("🎥 เริ่มต้นกล้อง... (กด 'q' เพื่อออก)")
    
    while True:
        ret, frame = video_capture.read()
        
        if not ret:
            print("❌ ไม่สามารถอ่านเฟรมจากกล้องได้")
            break
        
 
        face_locations, face_names = recognizer.recognize_faces(frame)
        
 
        for (top, right, bottom, left), name in zip(face_locations, face_names):

            if len(face_locations) < recognizer.min_faces:
                color = (0, 0, 255)  # แดง - จำนวนใบหน้าไม่เพียงพอ
            elif name == "Unknown":
                color = (0, 165, 255)  # ส้ม - ไม่รู้จัก
            elif name == "Error":
                color = (255, 0, 255)  # ม่วง - ข้อผิดพลาด
            else:
                color = (0, 255, 0)  # เขียว - รู้จัก
            

            cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
            

            cv2.rectangle(frame, (left, bottom - 35), (right, bottom), color, cv2.FILLED)

            font = cv2.FONT_HERSHEY_DUPLEX
            cv2.putText(frame, name, (left + 6, bottom - 6), font, 0.6, (255, 255, 255), 1)

        status_color = (0, 255, 0) if len(face_locations) >= recognizer.min_faces else (0, 0, 255)
        cv2.putText(frame, f"Faces: {len(face_locations)}/{recognizer.min_faces}", (10, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, status_color, 2)
        
        cv2.putText(frame, f"Known: {len(recognizer.known_face_names)}", (10, 60),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
 
        cv2.imshow('Enhanced Face Recognition', frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    video_capture.release()
    cv2.destroyAllWindows()
    print("🔚 ปิดโปรแกรมเรียบร้อย")

if __name__ == "__main__":
    main()