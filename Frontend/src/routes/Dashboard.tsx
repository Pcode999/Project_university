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
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
    else navigate("/login");
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-gradient-to-r from-emerald-600/95 to-green-600/95 border-b border-white/10 shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Logo + Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M4 8h16v8H4z" />
                  <path d="M2 12h2M20 12h2M8 20h8" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-wide text-white drop-shadow-sm">
                  Sleep Detector
                </h1>
                <p className="hidden sm:block text-white/80 text-xs">
                  AI-Powered Sleep Detection System
                </p>
              </div>
            </div>

            {/* Right: Desktop profile */}
            <div className="hidden md:flex items-center gap-4 text-white">
              {user?.profileImage && (
                <img
                  src={user.profileImage}
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover border-2 border-white/80 shadow"
                />
              )}
              <div className="text-sm leading-tight text-left">
                <p className="font-semibold truncate max-w-[200px]">{user?.username}</p>
                <p className="text-white/80 text-[13px] truncate max-w-[220px]">{user?.email}</p>
                <span className="inline-block mt-1 text-[11px] px-2 py-[2px] rounded-full bg-white/20 uppercase">
                  {user?.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 rounded-lg bg-red-500 hover:bg-red-600 px-4 py-2 text-sm font-medium text-white shadow transition"
              >
                Logout
              </button>
            </div>

            {/* Right: Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
              aria-label="Toggle menu"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile dropdown */}
          {menuOpen && (
            <div className="md:hidden mt-3 rounded-2xl bg-white/10 text-white p-3 shadow-lg border border-white/10">
              <div className="flex items-center gap-3">
                {user?.profileImage && (
                  <img
                    src={user.profileImage}
                    alt="Profile"
                    className="w-12 h-12 rounded-full object-cover border-2 border-white/80 shadow"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{user?.username}</p>
                  <p className="text-white/80 text-sm truncate">{user?.email}</p>
                  <span className="inline-block mt-1 text-[11px] px-2 py-[2px] rounded-full bg-white/20 uppercase">
                    {user?.role}
                  </span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => setMenuOpen(false)} className="rounded-lg bg-white/20 hover:bg-white/30 px-3 py-2 text-sm">
                  Close
                </button>
                <button onClick={handleLogout} className="rounded-lg bg-red-500 hover:bg-red-600 px-3 py-2 text-sm font-medium text-white">
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ===== Main Area ===== */}
      <main className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 gap-6">
          <section className="rounded-3xl bg-white shadow-xl ring-1 ring-black/5 p-4 sm:p-6">
            <MainContent />
          </section>

          <section className="rounded-3xl bg-white shadow-xl ring-1 ring-black/5 p-4 sm:p-6">
            <StudentSearch />
          </section>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
