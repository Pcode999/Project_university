import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StudentSearch from "../components/StudentSearch";
import MainContent from "../components/MainContent";

type UserInfo = {
  username: string;
  email: string;
  role: string;
  profileImage: string;
};

const Dashboard = () => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    } else {
      navigate("/login"); // 🔐 Redirect ถ้ายังไม่ได้ login
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login"); // 🚪 ไปหน้า LoginPage.tsx
  };

  return (
    <div className="min-h-screen bg-gray-200">
      <header className="bg-blue-800 text-white p-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sleep Detector</h1>
        <div className="flex items-center gap-4">
          {user?.profileImage && (
            <img
              src={user.profileImage}
              alt="Profile"
              className="w-10 h-10 rounded-full object-cover border-2 border-white"
            />
          )}
          <div className="text-white text-sm leading-snug text-left space-y-0.5">
            <p className="font-medium">
              Hello,{" "}
              <span className="text-blue-100 font-semibold">
                {user?.username}
              </span>
            </p>
            <p className="text-white/80 text-[13px] truncate max-w-[200px]">
              {user?.email}
            </p>
            <p className=" inline-block text-xs px-2 py-[2px] rounded-full text-white uppercase tracking-wide shadow-sm">
              {user?.role}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="ml-4 bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-1 rounded"
          >
            Logout
          </button>
        </div>
      </header>
      <div className="flex flex-col md:flex-row">
        <MainContent />
      </div>
      <div className="flex flex-col md:flex-row">
          <StudentSearch />
      </div>
    </div>
  );
};

export default Dashboard;
