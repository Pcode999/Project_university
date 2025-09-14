from tensorflow.keras.models import load_model
import numpy as np
import tensorflow as tf
import matplotlib.pyplot as plt
import cv2
from PIL import Image

class SleepDetector:
    def __init__(self, model_path="model/Eye_Detection.keras", img_height=180, img_width=180, data_cat=None):
        self.model = load_model(model_path)
        self.img_height = img_height
        self.img_width = img_width
        self.data_cat = data_cat if data_cat is not None else ["Closed", "Open"]
    
    def preprocess_image_from_array(self, img_array, resize=True):
        """
        Preprocess image from numpy array or OpenCV Mat
        Args:
            img_array: numpy array (OpenCV Mat) or PIL Image
            resize: whether to resize the image
        """
        # Handle different input types
        if isinstance(img_array, np.ndarray):
            # OpenCV Mat (BGR) to RGB conversion if needed
            if len(img_array.shape) == 3 and img_array.shape[2] == 3:
                # Convert BGR to RGB for OpenCV images
                img_array = cv2.cvtColor(img_array, cv2.COLOR_BGR2RGB)
            
            # Convert numpy array to PIL Image
            if img_array.dtype != np.uint8:
                img_array = (img_array * 255).astype(np.uint8)
            
            image = Image.fromarray(img_array)
        else:
            # Assume it's already a PIL Image
            image = img_array
        
        # Resize if requested
        if resize:
            image = image.resize((self.img_width, self.img_height))
        
        # Convert to array and add batch dimension
        img_arr = tf.keras.utils.img_to_array(image)
        img_bat = tf.expand_dims(img_arr, 0)  # Make it a batch
        return img_bat
    
    def preprocess_image_from_path(self, img_path, resize=True):
        """
        Original method for file path input (kept for backward compatibility)
        """
        if resize:
            image = tf.keras.utils.load_img(img_path, target_size=(self.img_height, self.img_width))
        else:
            image = tf.keras.utils.load_img(img_path)
        
        img_arr = tf.keras.utils.img_to_array(image)
        img_bat = tf.expand_dims(img_arr, 0)
        return img_bat
    
    def predict_from_array(self, img_array, resize=True):
        """
        Predict from numpy array or OpenCV Mat
        """
        img_bat = self.preprocess_image_from_array(img_array, resize)
        pred = self.model.predict(img_bat)
        score = tf.nn.softmax(pred[0])
        label = self.data_cat[np.argmax(score)]
        conf = np.max(score) * 100
        return label, conf
    
    def predict_from_path(self, img_path, resize=True):
        """
        Original predict method for file paths (kept for backward compatibility)
        """
        img_bat = self.preprocess_image_from_path(img_path, resize)
        pred = self.model.predict(img_bat)
        score = tf.nn.softmax(pred[0])
        label = self.data_cat[np.argmax(score)]
        conf = np.max(score) * 100
        return label, conf
    
    def plot_image_from_array(self, img_array, resize=True, title_suffix=""):
        """
        Plot image from numpy array or OpenCV Mat with prediction
        """
        label, conf = self.predict_from_array(img_array, resize)
        
        # Prepare image for display
        if isinstance(img_array, np.ndarray):
            display_img = img_array.copy()
            # Convert BGR to RGB for display if it's from OpenCV
            if len(display_img.shape) == 3 and display_img.shape[2] == 3:
                display_img = cv2.cvtColor(display_img, cv2.COLOR_BGR2RGB)
        else:
            display_img = img_array
        
        plt.figure(figsize=(8, 6))
        plt.imshow(display_img)
        plt.title(f"Prediction: {label} ({conf:.2f}%){title_suffix}")
        plt.axis('off')
        plt.show()
    
    def plot_image_from_path(self, img_path, resize=True):
        """
        Original plot method for file paths (kept for backward compatibility)
        """
        label, conf = self.predict_from_path(img_path, resize)
        image = tf.keras.utils.load_img(img_path)
        plt.imshow(image)
        plt.title(f"Prediction: {label} ({conf:.2f}%)")
        plt.axis('off')
        plt.show()