import { useEffect, useState } from "react"

type UserData = {
  _id?: string
  username: string
  email: string
  profileImage: string
}

type Behavior = {
  _id: string
  penalty: number
  created_at: string
}

type Props = {
  user: UserData
}

const StudentSleepReport = ({ user }: Props) => {
  const [report, setReport] = useState<Behavior[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?._id) return

    const fetchReport = async () => {
      try {
        const res = await fetch(`http://localhost:8000/behavior-report/${user._id}`)
        if (!res.ok) throw new Error("ไม่สามารถดึงข้อมูลพฤติกรรมได้")
        const data = await res.json()
        setReport(data)
      } catch (err) {
        console.error("❌ Failed to fetch behavior report:", err)
        setReport([])
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [user?._id])

  const total = report.length
  const totalPenalty = report.reduce((sum, r) => sum + r.penalty, 0)
  const warningThreshold = 5
  const isOverPenalty = totalPenalty >= warningThreshold

  return (
    <div>
      {isOverPenalty && (
        <div className="mb-4 p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg shadow">
          ⚠️ นักเรียนถูกหักคะแนนรวมแล้ว {totalPenalty} คะแนน — กรุณาระวังพฤติกรรมในห้องเรียน
        </div>
      )}

      <div className="flex items-center gap-4 mb-6">
        <img
          src={user.profileImage}
          alt="profile"
          className="w-20 h-20 rounded-full object-cover ring-2 ring-blue-400"
        />
        <div>
          <h2 className="text-xl font-semibold text-gray-800">{user.username}</h2>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-green-100 text-green-800 px-4 py-3 rounded-lg shadow">
          <h4 className="text-lg font-semibold">จำนวนครั้งที่บันทึก</h4>
          <p className="text-3xl">{loading ? "..." : `${total} ครั้ง`}</p>
        </div>
        <div className="bg-red-100 text-red-800 px-4 py-3 rounded-lg shadow">
          <h4 className="text-lg font-semibold">คะแนนที่ถูกหัก</h4>
          <p className="text-3xl">{loading ? "..." : `${totalPenalty} คะแนน`}</p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold mb-2">ประวัติพฤติกรรมการหลับในห้องเรียน</h3>
        {loading ? (
          <p className="text-gray-500 text-sm">กำลังโหลดข้อมูล...</p>
        ) : report.length === 0 ? (
          <p className="text-gray-500 text-sm italic">ยังไม่มีบันทึกพฤติกรรม</p>
        ) : (
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-200 text-gray-700 text-center">
                <th className="p-2 border">วันที่</th>
                <th className="p-2 border">เวลา</th>
                <th className="p-2 border">หักคะแนน</th>
              </tr>
            </thead>
            <tbody>
              {report.map((item) => {
                const utc = new Date(item.created_at)
                const bangkok = new Date(utc.getTime() + 7 * 60 * 60 * 1000)
                const date = bangkok.toLocaleDateString("th-TH")
                const time = bangkok.toLocaleTimeString("th-TH", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false
                })

                return (
                  <tr key={item._id} className="text-center">
                    <td className="p-2 border">{date}</td>
                    <td className="p-2 border">{time}</td>
                    <td className="p-2 border text-red-600 font-semibold">-{item.penalty}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default StudentSleepReport