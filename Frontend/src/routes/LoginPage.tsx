import { useNavigate } from "react-router-dom"
import { useState } from "react"
import { API_URL } from "../constant/constant"

const LoginPage = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async () => {
    if (!username || !password) {
      setError("กรุณากรอกข้อมูลให้ครบ")
      return
    }

    setIsLoading(true)
    setError(null)
 
    try {
      const url = API_URL + "login"
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.detail || "Login failed")
        return
      }

      // ✅ เก็บข้อมูลผู้ใช้หลัง login
      localStorage.setItem("user", JSON.stringify(data))

      const role = data.role

      // ✅ เปลี่ยนเส้นทางตาม role
      if (role === "admin") {
        navigate("/AdminDashboard")
      } else if (role === "student") {
        navigate("/StudentDashboard")
      } else if (role === "teacher") {
        navigate("/Dashboard")
      } else {
        setError("ไม่พบสิทธิ์ผู้ใช้งานที่ถูกต้อง")
      }

    } catch (err) {
      console.error("Login error:", err)
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 p-4 relative overflow-hidden">
      {/* Enhanced background pattern */}
      <div className="absolute inset-0">
        {/* Animated floating orbs */}
        <div className="absolute top-20 left-20 w-40 h-40 bg-gradient-to-r from-emerald-300 to-teal-300 rounded-full blur-3xl opacity-60 animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-56 h-56 bg-gradient-to-r from-purple-300 to-pink-300 rounded-full blur-3xl opacity-50 animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/3 right-1/4 w-32 h-32 bg-gradient-to-r from-blue-300 to-indigo-300 rounded-full blur-2xl opacity-40 animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-1/3 left-1/4 w-28 h-28 bg-gradient-to-r from-yellow-300 to-orange-300 rounded-full blur-2xl opacity-30 animate-pulse" style={{animationDelay: '3s'}}></div>
        
        {/* Geometric shapes */}
        <div className="absolute top-1/4 left-1/2 w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '0.5s'}}></div>
        <div className="absolute top-3/4 left-1/3 w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '1.5s'}}></div>
        <div className="absolute top-1/2 right-1/3 w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '2.5s'}}></div>
      </div>

      {/* Main Title with enhanced styling */}
      <div className="text-center py-8 relative z-10">
        <div className="inline-block px-8 py-4 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/30 shadow-lg mb-4">
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 bg-clip-text text-transparent drop-shadow-sm animate-fade-in">
            โปรแกรมตรวจจับคนหลับในห้องเรียน
          </h1>
          <p className="text-gray-700 text-lg mt-2 font-medium opacity-80">Sleep Detection System</p>
        </div>
      </div>
      
      <div className="flex items-center justify-center relative z-10">

      <div className="relative w-full max-w-md">
        {/* Login Card with enhanced styling */}
        <div className="bg-white/95 backdrop-blur-md p-10 rounded-3xl shadow-2xl border border-white/50 relative overflow-hidden group hover:shadow-3xl transition-all duration-300">
          {/* Card background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-gray-50/60 rounded-3xl"></div>
          
          {/* Animated border effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-400 rounded-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-sm"></div>
          
          {/* Logo/Icon with enhanced styling */}
          <div className="text-center mb-10 relative z-10">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-emerald-500 via-teal-500 to-blue-500 rounded-3xl mb-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 group/icon">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-blue-400 rounded-3xl blur-sm opacity-0 group-hover/icon:opacity-50 transition-opacity duration-300"></div>
              <svg className="w-12 h-12 text-white relative z-10 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-700 bg-clip-text text-transparent mb-3">เข้าสู่ระบบ</h1>
            <p className="text-gray-600 text-base font-medium">กรุณาใส่ข้อมูลเพื่อเข้าสู่ระบบ</p>
            <div className="w-16 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full mx-auto mt-4"></div>
          </div>

          {/* Enhanced Error Message */}
          {error && (
            <div className="mb-8 p-5 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl shadow-lg animate-shake relative z-10">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 14.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <p className="text-red-700 font-medium flex-1">{error}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-6">
            {/* Enhanced Username Field */}
            <div className="relative group">
              <label className="block text-base font-semibold text-gray-700 mb-3 transition-colors group-focus-within:text-emerald-600">ชื่อผู้ใช้งาน</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none z-10">
                  <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="ใส่ชื่อผู้ใช้งาน"
                  className="w-full pl-16 pr-5 py-5 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-300 bg-gradient-to-r from-gray-50 to-white focus:from-white focus:to-white text-gray-800 font-medium shadow-sm hover:shadow-md focus:shadow-lg"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Enhanced Password Field */}
            <div className="relative group">
              <label className="block text-base font-semibold text-gray-700 mb-3 transition-colors group-focus-within:text-emerald-600">รหัสผ่าน</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none z-10">
                  <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
                <input
                  type="password"
                  placeholder="ใส่รหัสผ่าน"
                  className="w-full pl-16 pr-5 py-5 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-300 bg-gradient-to-r from-gray-50 to-white focus:from-white focus:to-white text-gray-800 font-medium shadow-sm hover:shadow-md focus:shadow-lg"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Enhanced Login Button */}
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 text-white py-5 rounded-2xl font-bold text-lg hover:from-emerald-600 hover:via-teal-600 hover:to-blue-600 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none mt-10 relative overflow-hidden group/btn"
            >
              {/* Button shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"></div>
              {isLoading ? (
                <div className="flex items-center justify-center relative z-10">
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                  <span className="font-bold">กำลังเข้าสู่ระบบ...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center relative z-10">
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span className="font-bold">เข้าสู่ระบบ</span>
                </div>
              )}
            </button>
          </div>

          {/* Enhanced Sign Up Link */}
          <div className="mt-10 text-center relative z-10">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent mb-6"></div>
            <p className="text-gray-600 text-base">
              ยังไม่มีบัญชี?{" "}
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="text-emerald-600 hover:text-emerald-700 font-bold hover:underline transition-all duration-200 px-2 py-1 rounded-lg hover:bg-emerald-50 inline-flex items-center"
                disabled={isLoading}
              >
                สมัครสมาชิก
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </p>
          </div>
        </div>

        {/* Enhanced Footer */}
        <div className="mt-12 relative z-10">
          <div className="flex justify-between items-center p-6 bg-white/30 backdrop-blur-sm rounded-2xl border border-white/40 shadow-lg">
            <div className="text-left">
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <p className="text-gray-700 font-semibold">พัฒนาโดย:</p>
              </div>
              <p className="text-gray-600 text-sm font-medium ml-11">นาย ภานุรุจ เกินกลาง</p>
              <p className="text-gray-600 text-sm font-medium ml-11">นาย ภูวเนตร ภู่ทอง</p>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end mb-2">
                <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0V6a2 2 0 012-2h4a2 2 0 012 2v1" />
                </svg>
                <p className="text-gray-600 font-semibold">© 2024</p>
              </div>
              <p className="text-gray-500 text-sm">ระบบการเรียนการสอน</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

export default LoginPage

// Add custom CSS animations
const style = document.createElement('style')
style.textContent = `
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
  
  .animate-fade-in {
    animation: fade-in 1s ease-out;
  }
  
  .animate-shake {
    animation: shake 0.5s ease-in-out;
  }
`
if (typeof document !== 'undefined') {
  document.head.appendChild(style)
}