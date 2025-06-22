import { useNavigate } from "react-router-dom"
import { useState } from "react"

const LoginPage = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    if (!username || !password) {
      setError("กรุณากรอกข้อมูลให้ครบ")
      return
    }

    try {
      const res = await fetch("http://localhost:8000/login", {
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
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-4 text-center">Login</h1>

        {error && <p className="text-red-600 mb-4 text-center">{error}</p>}

        <input
          type="text"
          placeholder="Username"
          className="w-full mb-3 p-2 border rounded"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full mb-4 p-2 border rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleLogin}
          className="bg-blue-600 text-white w-full py-2 rounded hover:bg-blue-700 transition"
        >
          Login
        </button>

        <p className="text-center text-sm text-gray-600 mt-4">
          ยังไม่มีบัญชีใช่ไหม?{" "}
          <button
            type="button"
            onClick={() => navigate("/signup")}
            className="text-blue-600 hover:underline"
          >
            สมัครสมาชิก
          </button>
        </p>
      </div>
    </div>
  )
}

export default LoginPage