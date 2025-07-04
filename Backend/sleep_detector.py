import cv2
import numpy as np
import mediapipe as mp

class MediaPipeSleepDetector:
    def __init__(self, threshold=0.23):
        self.threshold = threshold
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(refine_landmarks=True, max_num_faces=5)
        self.left_eye_indices = [362, 385, 387, 263, 373, 380]
        self.right_eye_indices = [33, 160, 158, 133, 153, 144]

    def calculate_ear(self, eye_landmarks):
        A = np.linalg.norm(np.array(eye_landmarks[1]) - np.array(eye_landmarks[5]))
        B = np.linalg.norm(np.array(eye_landmarks[2]) - np.array(eye_landmarks[4]))
        C = np.linalg.norm(np.array(eye_landmarks[0]) - np.array(eye_landmarks[3]))
        return (A + B) / (2.0 * C) if C != 0 else 0

    def detect(self, frame):
        h, w = frame.shape[:2]
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_frame)

        detections = []

        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                left_eye = [(int(face_landmarks.landmark[i].x * w), int(face_landmarks.landmark[i].y * h)) for i in self.left_eye_indices]
                right_eye = [(int(face_landmarks.landmark[i].x * w), int(face_landmarks.landmark[i].y * h)) for i in self.right_eye_indices]

                left_ear = self.calculate_ear(left_eye)
                right_ear = self.calculate_ear(right_eye)
                ear = (left_ear + right_ear) / 2.0

                status = "SLEEPING" if ear < self.threshold * 0.8 else "DROWSY" if ear < self.threshold else "ACTIVE"
                color = (0, 0, 255) if status == "SLEEPING" else (0, 165, 255) if status == "DROWSY" else (0, 255, 0)

                x_coords = [p[0] for p in left_eye + right_eye]
                y_coords = [p[1] for p in left_eye + right_eye]
                box = (min(x_coords), min(y_coords), max(x_coords), max(y_coords))

                detections.append({
                    "left_eye": left_eye,
                    "right_eye": right_eye,
                    "ear": ear,
                    "status": status,
                    "color": color,
                    "box": box
                })

        return detections
