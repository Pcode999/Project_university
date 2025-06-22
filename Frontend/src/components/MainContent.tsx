import { useState, useRef } from "react";

const MainContent = () => {
  const [status, setStatus] = useState("Waiting...");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setStatus("Camera started");
      }
    } catch (error) {
      setStatus("Camera error");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);
      setStatus("Camera stopped");
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white p-8 rounded-xl shadow-xl">
        <video
          ref={videoRef}
          autoPlay
          muted
          className="w-full aspect-video bg-black rounded-lg shadow"
        />

        <div className="mt-6 flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={startCamera}
            className="min-w-[150px] bg-blue-600 text-white px-6 py-2 text-lg rounded hover:bg-blue-700 transition text-center"
          >
            Start Detection
          </button>

          <button
            onClick={stopCamera}
            className="min-w-[150px] bg-red-600 text-white px-6 py-2 text-lg rounded hover:bg-red-700 transition text-center"
          >
            Stop Camera
          </button>
        </div>

        <p className="text-center text-gray-700 mt-4 text-lg">
          Status: <span className="font-bold">{status}</span>
        </p>
      </div>
    </main>
  );
};

export default MainContent;
