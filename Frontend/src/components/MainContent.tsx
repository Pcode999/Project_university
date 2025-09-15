  // MainContent.tsx
  import React, { useState, useEffect, useRef, use } from 'react';

  const API_BASE_URL = 'http://localhost:8000';

  type StreamStatusType = 'connected' | 'disconnected' | 'error';

  type StatusPayload = {
    is_streaming: boolean;
    status: {
      label: string | null;
      confidence: number | null;
      faces: string[];
      timestamp: number | null;
    };
  };

  const MainContent: React.FC = () => {
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamStatus, setStreamStatus] = useState<StreamStatusType>('disconnected');
    const [label, setLabel] = useState<string | null>(null);
    const [confidence, setConfidence] = useState<number | null>(null);
    const [faces, setFaces] = useState<string[]>([]);
    const imgRef = useRef<HTMLImageElement | null>(null);

    const startStream = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/start_stream`, { method: 'POST' });
        if (response.ok) {
          setIsStreaming(true);
          setStreamStatus('connected');
          // รีเฟรช src เพื่อป้องกัน cache
          if (imgRef.current) {
            imgRef.current.src = `${API_BASE_URL}/video_feed?t=${Date.now()}`;
          }
        } else {
          setStreamStatus('error');
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
          setLabel(null);
          setConfidence(null);
          setFaces([]);
          if (imgRef.current) imgRef.current.src = '';
        }
      } catch (error) {
        console.error('Error stopping stream:', error);
      }
    };

    const checkStreamStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/stream_status`);
        const data: StatusPayload = await response.json();

        setIsStreaming(data.is_streaming);
        setStreamStatus(data.is_streaming ? 'connected' : 'disconnected');

        if (data.status) {
          setLabel(data.status.label);
          setConfidence(data.status.confidence);
          setFaces(data.status.faces || []);
        }
      } catch (error) {
        console.error('checkStreamStatus error:', error);
        setStreamStatus('error');
      }
    };

    useEffect(() => {
      checkStreamStatus();
      const interval = setInterval(checkStreamStatus, 1000); // โพลล์ทุก 1 วิ ให้ overlay ทันเหตุการณ์
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
      }, 1500);
    };

    return (
      <div className="w-full max-w-6xl mx-auto p-8">
        {/* Header Card */}
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl p-6 mb-8 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10 backdrop-blur-sm"></div>
          <div className="relative z-10 flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">การตรวจจับการนอนในห้องเรียน</h2>
              <p className="text-emerald-100 text-lg">AI-Powered Sleep Detection System</p>
            </div>
            <div className="flex items-center space-x-3 bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
              <div className={`w-4 h-4 rounded-full animate-pulse ${
                streamStatus === 'connected' ? 'bg-green-300' :
                streamStatus === 'error' ? 'bg-red-300' : 'bg-gray-300'
              }`} />
              <span className={`text-sm font-semibold ${
                streamStatus === 'connected' ? 'text-green-100' :
                streamStatus === 'error' ? 'text-red-100' : 'text-gray-100'
              }`}>
                {streamStatus === 'connected' ? 'เชื่อมต่อแล้ว' :
                streamStatus === 'error' ? 'เกิดข้อผิดพลาด' : 'ไม่ได้เชื่อมต่อ'}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-emerald-100 overflow-hidden">
          {/* Video Container */}
          <div className="p-8">
            <div className="relative bg-gradient-to-br from-slate-900 via-gray-900 to-black rounded-2xl overflow-hidden shadow-inner border-4 border-emerald-200/50" style={{ aspectRatio: '16/9' }}>
              {/* corners */}
              <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-emerald-400 rounded-tl-lg"></div>
              <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-emerald-400 rounded-tr-lg"></div>
              <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-emerald-400 rounded-bl-lg"></div>
              <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-emerald-400 rounded-br-lg"></div>

              {isStreaming ? (
                <div className="relative w-full h-full">
                  <img
                    ref={imgRef}
                    alt="Video Stream"
                    className="w-full h-full object-contain"
                    onError={handleImageError}
                    onLoad={() => setStreamStatus('connected')}
                  />
                  {/* LIVE */}
                  <div className="absolute top-6 right-6 flex items-center space-x-2 bg-red-500/90 backdrop-blur-sm rounded-full px-3 py-1">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span className="text-white text-sm font-medium">LIVE</span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white">
                  <div className="text-center space-y-6">
                    <div className="relative">
                      <div className="text-8xl mb-4 animate-bounce">📹</div>
                      <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl"></div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xl font-medium">พร้อมเริ่มการตรวจจับ</p>
                      <p className="text-emerald-300 text-sm">กดปุ่ม "เริ่มการตรวจจับ" เพื่อเริ่มต้นระบบ</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Controls Section */}
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-8 py-6">
            <div className="flex justify-center space-x-6">
              {!isStreaming ? (
                <button
                  onClick={startStream}
                  className="group relative px-10 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl hover:from-emerald-600 hover:to-green-700 transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:scale-105 font-semibold text-lg overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/20 transform translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                  <div className="relative flex items-center space-x-3">
                    <span className="text-2xl">▶️</span>
                    <span>เริ่มการตรวจจับ</span>
                  </div>
                </button>
              ) : (
                <button
                  onClick={stopStream}
                  className="group relative px-10 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl hover:from-red-600 hover:to-red-700 transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:scale-105 font-semibold text-lg overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/20 transform translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                  <div className="relative flex items-center space-x-3">
                    <span className="text-2xl">⏹️</span>
                    <span>หยุดการตรวจจับ</span>
                  </div>
                </button>
              )}
            </div>

            {/* Status Bar */}
            <div className="mt-6 flex justify-center">
              <div className="bg-white/70 backdrop-blur-sm rounded-full px-6 py-2 shadow-md">
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-700">System Ready</span>
                  </div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-700">
                      AI Detection: {isStreaming ? 'Active' : 'Standby'}
                    </span>
                  </div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-gray-700">
                      Label: {label ?? '—'} {confidence != null ? `(${(confidence * 100).toFixed(0)}%)` : ''}
                    </span>
                  </div>
                  {!!faces.length && (
                    <>
                      <div className="w-px h-4 bg-gray-300"></div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span className="text-gray-700">Faces: {faces.join(', ')}</span>
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
