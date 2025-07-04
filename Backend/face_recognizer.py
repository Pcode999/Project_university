# ✅ face_recognizer.py
import os
import cv2
import face_recognition

class FaceRecognizer:
    def __init__(self, image_folder="images"):
        self.image_folder = image_folder
        self.known_face_encodings = []
        self.known_face_names = []
        self.load_known_faces()

    def load_known_faces(self):
        print("🔄 โหลดใบหน้าที่รู้จักจาก:", self.image_folder)
        for filename in os.listdir(self.image_folder):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                image_path = os.path.join(self.image_folder, filename)
                image = face_recognition.load_image_file(image_path)
                encoding = face_recognition.face_encodings(image)
                if encoding:
                    self.known_face_encodings.append(encoding[0])
                    name = os.path.splitext(filename)[0]
                    self.known_face_names.append(name)
                    print(f"✅ โหลดใบหน้า: {name}")
                else:
                    print(f"⚠️ ไม่สามารถเข้ารหัสใบหน้าในไฟล์: {filename}")

    def recognize_faces(self, frame):
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        face_locations = face_recognition.face_locations(rgb_frame)
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)

        names = []
        for face_encoding in face_encodings:
            matches = face_recognition.compare_faces(self.known_face_encodings, face_encoding)
            name = "Unknown"
            if True in matches:
                match_index = matches.index(True)
                name = self.known_face_names[match_index]
            names.append(name)

        return face_locations, names