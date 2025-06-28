// ✅ React Component (MainContent.tsx)
import React, { useState, useEffect, useRef } from 'react';

const API_BASE_URL = 'http://localhost:8000';

const MainContent: React.FC = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  const imgRef = useRef<HTMLImageElement | null>(null);

  const startStream = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/start_stream`, { method: 'POST' });
      if (response.ok) {
        setIsStreaming(true);
        setStreamStatus('connected');
      }
    } catch (error) {
      console.error('Error starting stream:', error);
      setStreamStatus('error');
    }
  };

  const stopStream = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/stop_stream`, { method: 'POST' });
      if (response.ok) {
        setIsStreaming(false);
        setStreamStatus('disconnected');
        if (imgRef.current) imgRef.current.src = '';
      }
    } catch (error) {
      console.error('Error stopping stream:', error);
    }
  };

  const checkStreamStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/stream_status`);
      const data = await response.json();
      setIsStreaming(data.is_streaming);
      setStreamStatus(data.is_streaming ? 'connected' : 'disconnected');
    } catch (error) {
      setStreamStatus('error');
    }
  };

  useEffect(() => {
    checkStreamStatus();
    const interval = setInterval(checkStreamStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isStreaming && imgRef.current) {
      imgRef.current.src = `${API_BASE_URL}/video_feed?t=${Date.now()}`;
    }
  }, [isStreaming]);

  const handleImageError = () => {
    setStreamStatus('error');
    setTimeout(() => {
      if (isStreaming && imgRef.current) {
        imgRef.current.src = `${API_BASE_URL}/video_feed?t=${Date.now()}`;
      }
    }, 3000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">การตรวจจับการนอนในห้องเรียน</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${streamStatus === 'connected' ? 'bg-green-500' : streamStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'}`} />
          <span className={`text-sm font-medium ${streamStatus === 'connected' ? 'text-green-500' : streamStatus === 'error' ? 'text-red-500' : 'text-gray-500'}`}>
            {streamStatus === 'connected' ? 'เชื่อมต่อแล้ว' : streamStatus === 'error' ? 'เกิดข้อผิดพลาด' : 'ไม่ได้เชื่อมต่อ'}
          </span>
        </div>
      </div>

      <div className="relative bg-black rounded-lg overflow-hidden mb-4" style={{ aspectRatio: '4/3' }}>
        {isStreaming ? (
          <img
            ref={imgRef}
            alt="Video Stream"
            className="w-full h-full object-contain"
            onError={handleImageError}
            onLoad={() => setStreamStatus('connected')}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white">
            <div className="text-center">
              <div className="text-6xl mb-4">📹</div>
              <p className="text-lg">กดปุ่ม "เริ่มการตรวจจับ" เพื่อเริ่มต้น</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center space-x-4">
        {!isStreaming ? (
          <button onClick={startStream} className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
            ▶️ เริ่มการตรวจจับ
          </button>
        ) : (
          <button onClick={stopStream} className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
            ⏹️ หยุดการตรวจจับ
          </button>
        )}
      </div>
    </div>
  );
};

export default MainContent;