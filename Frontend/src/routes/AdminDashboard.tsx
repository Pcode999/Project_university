import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import UserManagement from "../components/UserManagement";
import CourseManagement from "../components/CourseManagement";

type CurrentUser = {
  username: string;
  email: string;
  role: string;
  profileImage: string;
};

const AdminDashboard = () => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'courses'>('users');

  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setCurrentUser(JSON.parse(stored));
    else navigate("/login");
  }, [navigate]);


  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-emerald-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent"></div>
        <div className="relative z-10 px-6 py-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <span className="text-emerald-600 font-bold text-xl">⚡</span>
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                <p className="text-emerald-100 text-sm">การจัดการผู้ใช้งานระบบ</p>
              </div>
            </div>

            {currentUser && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                <div className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/20">
                  <img
                    src={currentUser.profileImage || "https://placehold.co/40x40?text=👤"}
                    alt="Admin"
                    className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-lg"
                  />
                  <div className="text-sm leading-tight">
                    <p className="font-semibold text-white truncate max-w-[180px]">
                      {currentUser.username}
                    </p>
                    <p className="text-emerald-100 text-xs truncate max-w-[180px]">
                      {currentUser.email}
                    </p>
                    <span className="inline-block mt-1 px-2 py-1 bg-emerald-500/30 rounded-full text-emerald-100 text-xs capitalize">
                      {currentUser.role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm px-6 py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-medium w-full sm:w-auto"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
        {/* Tabs Navigation */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              className={`flex-1 py-4 px-6 text-center font-medium transition-all duration-200 ${
                activeTab === 'users'
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-tl-2xl'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('users')}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">👥</span>
                <span>User Management</span>
              </div>
            </button>
            <button
              className={`flex-1 py-4 px-6 text-center font-medium transition-all duration-200 ${
                activeTab === 'courses'
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-tr-2xl'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('courses')}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">📚</span>
                <span>Course Management</span>
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'courses' && <CourseManagement />}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
