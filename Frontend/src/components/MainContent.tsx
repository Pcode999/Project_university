// MainContent.tsx
import React, { useState, useEffect, useRef } from "react";
import { API_URL } from "../constant/constant";
import CourseSelector from "./CourseSelector";

const API_BASE_URL = API_URL;

type StreamStatusType = "connected" | "disconnected" | "error";

type StatusPayload = {
  is_streaming: boolean;
  status: {
    label: string | null;
    confidence: number | null; // 0–100 จาก backend
    faces: string[];
    timestamp: number | null;
  };
  current_course_id: string | null;
};

const MainContent: React.FC = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState<StreamStatusType>("disconnected");
  const [label, setLabel] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [faces, setFaces] = useState<string[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [isUsingCamera, setIsUsingCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync course selection with backend
  const handleCourseSelect = async (courseId: string | null) => {
    setSelectedCourseId(courseId);
    try {
      await fetch(`${API_BASE_URL}set_course_for_detection`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ course_id: courseId }),
      });
    } catch (error) {
      console.error("Error setting course for detection:", error);
    }
  };

  // เริ่มใช้กล้องจาก Frontend
  const startCameraStream = async () => {
    console.log("🎥 Starting camera stream...");
    
    // ตรวจสอบว่า browser รองรับ getUserMedia หรือไม่
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("❌ Browser ไม่รองรับการใช้งานกล้อง กรุณาใช้ Chrome, Firefox หรือ Edge");
      setStreamStatus("error");
      return;
    }
    
    // ตรวจสอบ HTTPS
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      alert("⚠️ การใช้งานกล้องต้องใช้ HTTPS หรือ localhost");
      setStreamStatus("error");
      return;
    }
    
    try {
      console.log("📷 Requesting camera access...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user" // ใช้กล้องหน้า
        },
        audio: false
      });
      
      console.log("✅ Camera access granted");
      setStream(mediaStream);
      setIsUsingCamera(true);
      setIsStreaming(true);
      setStreamStatus("connected");
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        console.log("📹 Video element is playing");
      }
      
      // เริ่มส่งเฟรมไปยัง backend
      console.log("🚀 Starting frame capture...");
      startFrameCapture();
      
    } catch (error: any) {
      console.error("❌ Error accessing camera:", error);
      setStreamStatus("error");
      
      let errorMessage = "ไม่สามารถเข้าถึงกล้องได้";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "🚫 กรุณาอนุญาตการใช้งานกล้องใน browser";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "📷 ไม่พบกล้อง กรุณาเชื่อมต่อกล้องเว็บ";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "🔒 กล้องกำลังถูกใช้งานโดยแอปอื่น";
      } else if (error.name === 'NotSupportedError') {
        errorMessage = "❌ Browser ไม่รองรับการใช้งานกล้อง";
      }
      
      alert(errorMessage);
    }
  };

  // เริ่มใช้ backend stream (แบบเดิม)
  const startBackendStream = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}start_stream`, { method: "POST" });
      if (response.ok) {
        setIsStreaming(true);
        setIsUsingCamera(false);
        setStreamStatus("connected");
        if (imgRef.current) {
          imgRef.current.src = `${API_BASE_URL}video_feed?t=${Date.now()}`;
        }
      } else setStreamStatus("error");
    } catch (e) {
      console.error("Error starting stream:", e);
      setStreamStatus("error");
    }
  };

  // หยุดใช้กล้อง
  const stopCameraStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsUsingCamera(false);
    setIsStreaming(false);
    setStreamStatus("disconnected");
    setLabel(null);
    setConfidence(null);
    setFaces([]);
  };

  // หยุด backend stream
  const stopBackendStream = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}stop_stream`, { method: "POST" });
      if (response.ok) {
        setIsStreaming(false);
        setIsUsingCamera(false);
        setStreamStatus("disconnected");
        setLabel(null);
        setConfidence(null);
        setFaces([]);
        if (imgRef.current) imgRef.current.src = "";
      }
    } catch (e) {
      console.error("Error stopping stream:", e);
    }
  };

  // หยุดการสตรีมทั้งหมด
  const stopStream = () => {
    if (isUsingCamera) {
      stopCameraStream();
    } else {
      stopBackendStream();
    }
  };

  const checkStreamStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}stream_status`);
      const data: StatusPayload = await response.json();
      setIsStreaming(data.is_streaming);
      setStreamStatus(data.is_streaming ? "connected" : "disconnected");
      if (data.status) {
        setLabel(data.status.label);
        setConfidence(data.status.confidence);
        setFaces(data.status.faces || []);
      }
      // Sync course selection from backend
      if (data.current_course_id !== undefined) {
        setSelectedCourseId(data.current_course_id);
      }
    } catch (e) {
      console.error("checkStreamStatus error:", e);
      setStreamStatus("error");
    }
  };

  useEffect(() => {
    checkStreamStatus();
    const interval = setInterval(checkStreamStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isStreaming && !isUsingCamera && imgRef.current) {
      imgRef.current.src = `${API_BASE_URL}video_feed?t=${Date.now()}`;
    }
  }, [isStreaming, isUsingCamera]);

  // ทำความสะอาดเมื่อ component unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // ส่งเฟรมจากกล้องไปยัง backend เพื่อประมวลผล
  const startFrameCapture = () => {
    let frameCount = 0;
    
    const captureFrame = async () => {
      if (videoRef.current && canvasRef.current && isStreaming && isUsingCamera) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext('2d');
        
        // ตรวจสอบว่า video พร้อมใช้งาน
        if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) {
          console.log("⏳ Waiting for video to be ready...");
          return;
        }
        
        try {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          
          // แปลงเป็น base64
          const imageData = canvas.toDataURL('image/jpeg', 0.8);
          frameCount++;
          
          console.log(`📸 Frame ${frameCount} captured, size: ${canvas.width}x${canvas.height}`);
          
          // ส่งไปยัง backend เพื่อประมวลผล
          const response = await fetch(`${API_BASE_URL}process_frame`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ image: imageData })
          });
          
          if (response.ok) {
            const data = await response.json();
            setLabel(data.label || null);
            setConfidence(data.confidence || null);
            setFaces(data.faces || []);
          } else {
            console.error(`❌ Backend error: ${response.status} - ${response.statusText}`);
          }
        } catch (error) {
          console.error("❌ Error processing frame:", error);
        }
      }
    };
    
    console.log("⏰ Setting up frame capture interval (every 1000ms)");
    // เปลี่ยนจาก 500ms เป็น 1000ms เพื่อลดโหลด
    const interval = setInterval(captureFrame, 1000);
    
    // เก็บ interval reference เพื่อจะได้ clear ได้
    return () => {
      console.log("🛑 Clearing frame capture interval");
      clearInterval(interval);
    };
  };

  const handleImageError = () => {
    if (!isUsingCamera) {
      setStreamStatus("error");
      setTimeout(() => {
        if (isStreaming && imgRef.current) {
          imgRef.current.src = `${API_BASE_URL}video_feed?t=${Date.now()}`;
        }
      }, 1500);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header Card */}
      <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10 backdrop-blur-sm"></div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">
              การตรวจจับการนอนในห้องเรียน
            </h2>
            <p className="text-emerald-100 text-sm sm:text-base">
              AI-Powered Sleep Detection System
            </p>
          </div>
          <div className="flex items-center space-x-3 bg-white/20 backdrop-blur-sm rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 self-start">
            <div
              className={`w-3 h-3 rounded-full animate-pulse ${
                streamStatus === "connected"
                  ? "bg-green-300"
                  : streamStatus === "error"
                  ? "bg-red-300"
                  : "bg-gray-300"
              }`}
            />
            <span
              className={`text-xs sm:text-sm font-semibold ${
                streamStatus === "connected"
                  ? "text-green-100"
                  : streamStatus === "error"
                  ? "text-red-100"
                  : "text-gray-100"
              }`}
            >
              {streamStatus === "connected"
                ? "เชื่อมต่อแล้ว"
                : streamStatus === "error"
                ? "เกิดข้อผิดพลาด"
                : "ไม่ได้เชื่อมต่อ"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-3xl shadow-2xl border border-emerald-100 overflow-hidden">
        {/* Video Container */}
        <div className="p-4 sm:p-6 lg:p-8">
          <div
            className="relative bg-gradient-to-br from-slate-900 via-gray-900 to-black rounded-2xl overflow-hidden shadow-inner border-4 border-emerald-200/50"
            style={{ aspectRatio: "16/9" }}
          >
            {/* corners */}
            <div className="absolute top-3 left-3 w-5 h-5 border-l-2 border-t-2 border-emerald-400 rounded-tl-lg"></div>
            <div className="absolute top-3 right-3 w-5 h-5 border-r-2 border-t-2 border-emerald-400 rounded-tr-lg"></div>
            <div className="absolute bottom-3 left-3 w-5 h-5 border-l-2 border-b-2 border-emerald-400 rounded-bl-lg"></div>
            <div className="absolute bottom-3 right-3 w-5 h-5 border-r-2 border-b-2 border-emerald-400 rounded-br-lg"></div>

            {isStreaming ? (
              <div className="relative w-full h-full">
                {isUsingCamera ? (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-contain"
                      autoPlay
                      muted
                      playsInline
                    />
                    <canvas
                      ref={canvasRef}
                      className="hidden"
                    />
                  </>
                ) : (
                  <img
                    ref={imgRef}
                    alt="Video Stream"
                    className="w-full h-full object-contain"
                    onError={handleImageError}
                    onLoad={() => setStreamStatus("connected")}
                  />
                )}
                {/* LIVE */}
                <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center space-x-2 bg-red-500/90 backdrop-blur-sm rounded-full px-2.5 py-0.5 sm:px-3 sm:py-1">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="text-white text-xs sm:text-sm font-medium">
                    {isUsingCamera ? "CAMERA" : "LIVE"}
                  </span>
                </div>
                {/* แสดงข้อมูลการตรวจจับบนหน้าจอ */}
                {(label || faces.length > 0) && (
                  <div className="absolute bottom-4 left-4 bg-black/70 text-white p-3 rounded-lg">
                    {label && (
                      <div className="text-sm">
                        Status: <span className="font-bold">{label}</span>
                        {confidence && (
                          <span className="ml-2">({confidence.toFixed(0)}%)</span>
                        )}
                      </div>
                    )}
                    {faces.length > 0 && (
                      <div className="text-xs mt-1">
                        Faces: {faces.join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                <div className="text-center space-y-4 sm:space-y-6">
                  <div className="relative">
                    <div className="text-6xl sm:text-8xl mb-3 sm:mb-4 animate-bounce">📹</div>
                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl"></div>
                  </div>
                  <div className="space-y-1 sm:space-y-2">
                    <p className="text-lg sm:text-xl font-medium">พร้อมเริ่มการตรวจจับ</p>
                    <p className="text-emerald-300 text-xs sm:text-sm">
                      กดปุ่ม "เริ่มการตรวจจับ" เพื่อเริ่มต้นระบบ
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Course Selection Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 sm:px-6 lg:px-8 py-4 border-b border-gray-100">
          <CourseSelector
            selectedCourseId={selectedCourseId}
            onCourseSelect={handleCourseSelect}
            className="max-w-md mx-auto"
          />
        </div>

        {/* Controls Section */}
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            {!isStreaming ? (
              <>
                <button
                  onClick={startCameraStream}
                  className="group relative w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:scale-105 font-semibold text-base overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/20 transform translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                  <div className="relative flex items-center justify-center space-x-3">
                    <span className="text-lg">📷</span>
                    <span>ใช้กล้องเว็บ</span>
                  </div>
                </button>
                <button
                  onClick={startBackendStream}
                  className="group relative w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl hover:from-emerald-600 hover:to-green-700 transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:scale-105 font-semibold text-base overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/20 transform translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                  <div className="relative flex items-center justify-center space-x-3">
                    <span className="text-lg">🖥️</span>
                    <span>ใช้เซิร์ฟเวอร์</span>
                  </div>
                </button>
              </>
            ) : (
              <button
                onClick={stopStream}
                className="group relative w-full sm:w-auto px-6 sm:px-10 py-3 sm:py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl hover:from-red-600 hover:to-red-700 transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:scale-105 font-semibold text-base sm:text-lg overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/20 transform translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                <div className="relative flex items-center justify-center space-x-3">
                  <span className="text-xl sm:text-2xl">⏹️</span>
                  <span>หยุดการตรวจจับ</span>
                </div>
              </button>
            )}
          </div>

          {/* Status Bar */}
          <div className="mt-4 sm:mt-6 flex justify-center">
            <div className="bg-white/70 backdrop-blur-sm rounded-full px-4 sm:px-6 py-2 shadow-md">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-gray-700">System Ready</span>
                </div>
                <div className="hidden sm:block w-px h-4 bg-gray-300" />
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-700">
                    AI Detection: {isStreaming ? (isUsingCamera ? "Camera Active" : "Server Active") : "Standby"}
                  </span>
                </div>
                <div className="hidden sm:block w-px h-4 bg-gray-300" />
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-gray-700">
                    Label: {label ?? "—"}{" "}
                    {confidence != null ? `(${confidence.toFixed(0)}%)` : ""}
                  </span>
                </div>
                {!!faces.length && (
                  <>
                    <div className="hidden sm:block w-px h-4 bg-gray-300" />
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span className="text-gray-700">
                        Faces: {faces.join(", ")}
                      </span>
                    </div>
                  </>
                )}
                {selectedCourseId && (
                  <>
                    <div className="hidden sm:block w-px h-4 bg-gray-300" />
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <span className="text-gray-700">
                        Course: Selected
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainContent;
