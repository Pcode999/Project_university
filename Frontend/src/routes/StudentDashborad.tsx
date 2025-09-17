import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

type UserData = {
  _id?: string
  username: string
  email: string
  profileImage: string
  role: string
}

type SleepRecord = {
  name: string
  time: string
}

const StudentDashboard = () => {
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<SleepRecord[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    const stored = localStorage.getItem("user")
    if (!stored) {
      navigate("/login")
      return
    }

    const parsedUser = JSON.parse(stored) as UserData

    if (parsedUser.role !== "student") {
      navigate("/login")
      return
    }

    setUser(parsedUser)

    const fetchHistory = async () => {
      try {
        const res = await fetch("http://localhost:8000/who-sleeping")
        const data = await res.json()
        const filtered = data.list.filter((h: SleepRecord) => h.name === parsedUser.username)
        setHistory(filtered)
      } catch (err) {
        console.error("❌ Failed to fetch sleep history:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [navigate])

  // === ฟังก์ชัน Export CSV ===
  const handleExportCSV = () => {
    if (!user) return
    const header = ["Time", "Status"]
    const rows = history.map(h => [h.time, "Sleep"])

    let csvContent =
      "data:text/csv;charset=utf-8," +
      [header, ...rows].map(row => row.join(",")).join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `sleep_history_${user.username}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // === ฟังก์ชัน Logout ===
  const handleLogout = () => {
    localStorage.removeItem("user")
    navigate("/login")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header + Logout */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-emerald-700">Student Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition"
          >
            Logout
          </button>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 flex items-center gap-4">
          <img
            src={user?.profileImage || "https://placehold.co/80x80?text=👤"}
            alt="Profile"
            className="w-20 h-20 rounded-full border-4 border-emerald-200 object-cover"
          />
          <div>
            <h2 className="text-xl font-bold text-gray-800">{user?.username}</h2>
            <p className="text-gray-500 text-sm">{user?.email}</p>
            <span className="inline-block mt-2 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
              {user?.role}
            </span>
          </div>
        </div>

        {/* สถานะล่าสุด */}
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-2">สถานะล่าสุด</h3>
          {history.length > 0 ? (
            <>
              <p className="text-2xl font-bold">😴 Sleep</p>
              <p className="text-sm mt-2">ตรวจพบเมื่อ: {history[history.length - 1].time}</p>
            </>
          ) : (
            <p className="text-sm text-emerald-100">ยังไม่พบประวัติการนอน</p>
          )}
        </div>

        {/* ตารางประวัติ */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-700">ประวัติการนอน</h3>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">เวลา</th>
                  <th className="px-4 py-2 text-left">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.length > 0 ? (
                  history.map((h, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2">{h.time}</td>
                      <td className="px-4 py-2">Sleep</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-4 py-4 text-center text-gray-500">
                      ไม่มีประวัติการนอน
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StudentDashboard
