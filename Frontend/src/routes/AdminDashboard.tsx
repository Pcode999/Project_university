import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import EditUserForm from "../components/EditUserForm"

type User = {
  _id: string
  username: string
  email: string
  password: string
  role: string
  profileImage: string
}

type CurrentUser = {
  username: string
  email: string
  role: string
  profileImage: string
}

const AdminDashboard = () => {
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [penalties, setPenalties] = useState<Record<string, number>>({})

  const navigate = useNavigate()

  useEffect(() => {
    const stored = localStorage.getItem("user")
    if (stored) {
      setCurrentUser(JSON.parse(stored))
    } else {
      navigate("/login")
    }
  }, [navigate])

  const fetchUsers = async () => {
    try {
      const res = await fetch("http://localhost:8000/users")
      const data = await res.json()
      setUsers(data)
    } catch {
      setError("Failed to fetch users.")
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

useEffect(() => {
  const fetchPenalties = async () => {
    const result: Record<string, number> = {}
    await Promise.all(
      users.map(async (user) => {
        if (user.role === "student") {
          try {
            const res = await fetch(`http://localhost:8000/behavior-reports/student/${user._id}`)
            
            if (res.ok) {
              const data = await res.json()
              const total = data.reduce((sum: number, r: any) => sum + r.penalty, 0)
              result[user._id] = total
            } else {
              result[user._id] = 0
            }
          } catch (error) {
            console.error(`Error fetching penalties for user ${user._id}:`, error)
            result[user._id] = 0
          }
        }
      })
    )
    setPenalties(result)
  }

  if (users.length > 0) {
    fetchPenalties()
  }
}, [users])

  const handleLogout = () => {
    localStorage.removeItem("user")
    navigate("/login")
  }

  const handleDelete = async (userId: string) => {
    try {
      const res = await fetch(`http://localhost:8000/users/${userId}`, {
        method: "DELETE",
      })
      if (res.ok) fetchUsers()
      else setError("Failed to delete user.")
    } catch {
      setError("Failed to delete user.")
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-gradient-to-r from-purple-500 to-purple-600 text-white'
      case 'teacher':
        return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
      case 'student':
        return 'bg-gradient-to-r from-green-500 to-green-600 text-white'
      default:
        return 'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
    }
  }

  const getPenaltyColor = (penalty: number) => {
    if (penalty === 0) return 'text-green-600'
    if (penalty <= 10) return 'text-yellow-600'
    if (penalty <= 20) return 'text-orange-600'
    return 'text-red-600'
  }

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
      <div className="container mx-auto p-6 max-w-7xl">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-700 text-center font-medium">{error}</p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Users</p>
                <p className="text-2xl font-bold text-gray-800">{users.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <span className="text-blue-600 text-xl">👥</span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Students</p>
                <p className="text-2xl font-bold text-gray-800">{users.filter(u => u.role === 'student').length}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <span className="text-green-600 text-xl">🎓</span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-purple-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Teachers</p>
                <p className="text-2xl font-bold text-gray-800">{users.filter(u => u.role === 'teacher').length}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <span className="text-purple-600 text-xl">👨‍🏫</span>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
            <h2 className="text-xl font-bold text-gray-800">User Management</h2>
            <p className="text-sm text-gray-500 mt-1">จัดการข้อมูลผู้ใช้งานทั้งหมด</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gradient-to-r from-emerald-500 to-green-600 text-white">
                  <th className="py-4 px-6 text-left font-semibold">Profile</th>
                  <th className="py-4 px-6 text-left font-semibold">Password</th>
                  <th className="py-4 px-6 text-left font-semibold">Role</th>
                  <th className="py-4 px-6 text-left font-semibold">คะแนนที่ถูกหัก</th>
                  <th className="py-4 px-6 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user, index) =>
                  editingId === user._id ? (
                    <tr key={user._id} className="bg-blue-50">
                      <td colSpan={5} className="p-6">
                        <EditUserForm
                          user={user}
                          onCancel={() => setEditingId(null)}
                          onSave={() => {
                            setEditingId(null)
                            fetchUsers()
                          }}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={user._id} className={`transition-colors duration-200 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <img
                              src={user.profileImage || "https://placehold.co/48x48?text=👤"}
                              alt="profile"
                              className="w-12 h-12 rounded-xl object-cover border-2 border-gray-200 shadow-md"
                            />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{user.username}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <code className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-mono text-gray-700">
                          {'•'.repeat(user.password.length)}
                        </code>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {user.role === "student" ? (
                          <div className="flex items-center space-x-2">
                            <span className={`text-lg font-bold ${getPenaltyColor(penalties[user._id] || 0)}`}>
                              -{penalties[user._id] || 0}
                            </span>
                            <span className="text-xs text-gray-500">คะแนน</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">N/A</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex gap-2">
                          <button
                            className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg transform hover:scale-105"
                            onClick={() => setEditingId(user._id)}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg transform hover:scale-105"
                            onClick={() => handleDelete(user._id)}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard