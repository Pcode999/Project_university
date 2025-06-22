import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import StudentSleepReport from "../components/StudentSleepReport"

type UserData = {
  _id?: string
  username: string
  email: string
  profileImage: string
  role: string
}

const StudentDashboard = () => {
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const stored = localStorage.getItem("user")
    if (!stored) {
      navigate("/login") // ไม่พบข้อมูลผู้ใช้ → กลับไปหน้า login
      return
    }

    const parsedUser = JSON.parse(stored) as UserData

    if (parsedUser.role !== "student") {
      navigate("/login") // ไม่ใช่นักเรียน → redirect
      return
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`http://localhost:8000/student/${parsedUser.username}`)
        if (!res.ok) throw new Error("User not found")
        const data = await res.json()
        setUser(data)
      } catch (err) {
        console.error("❌ Failed to fetch user:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [navigate])

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md p-6">
        {loading ? (
          <p className="text-gray-500 text-center">กำลังโหลดข้อมูล...</p>
        ) : user ? (
          <StudentSleepReport user={user} />
        ) : (
          <p className="text-red-600 text-center">ไม่พบนักเรียน</p>
        )}
      </div>
    </div>
  )
}

export default StudentDashboard