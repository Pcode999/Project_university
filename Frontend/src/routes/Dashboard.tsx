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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header with green theme matching the login form */}
      <header className="bg-gradient-to-r from-emerald-600 to-green-600 text-white p-4 flex items-center justify-between shadow-lg">
        <h1 className="text-2xl font-bold">Sleep Detector</h1>
        <div className="flex items-center gap-4">
          {user?.profileImage && (
            <img
              src={user.profileImage}
              alt="Profile"
              className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md"
            />
          )}
          <div className="text-white text-sm leading-snug text-left space-y-0.5">
            <p className="font-medium">
              Hello,{" "}
              <span className="text-green-100 font-semibold">
                {user?.username}
              </span>
            </p>
            <p className="text-white/80 text-[13px] truncate max-w-[200px]">
              {user?.email}
            </p>
            <p className="inline-block text-xs px-2 py-[2px] bg-green-500/30 rounded-full text-white uppercase tracking-wide shadow-sm">
              {user?.role}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="ml-4 bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-1 rounded-md transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            Logout
          </button>
        </div>
      </header>
      
      {/* Main content area with subtle green background */}
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