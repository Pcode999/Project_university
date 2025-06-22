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
              const res = await fetch(`http://localhost:8000/behavior-report/${user._id}`)
              const data = await res.json()
              const total = data.reduce((sum: number, r: any) => sum + r.penalty, 0)
              result[user._id] = total
            } catch {
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

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-800 text-white px-6 py-4 shadow">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          {currentUser && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
              <div className="flex items-center gap-4">
                <img
                  src={currentUser.profileImage || "https://placehold.co/40x40?text=👤"}
                  alt="Admin"
                  className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm"
                />
                <div className="text-sm leading-tight">
                  <p className="font-semibold text-white truncate max-w-[180px]">
                    {currentUser.username}
                  </p>
                  <p className="text-gray-200 text-xs truncate max-w-[180px]">
                    {currentUser.email}
                  </p>
                  <p className="text-blue-100 text-xs italic capitalize">
                    {currentUser.role}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1.5 rounded w-full sm:w-auto"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="container mx-auto p-4 sm:p-6">
        {error && <p className="text-red-600 text-center mb-4">{error}</p>}

        <div className="overflow-x-auto bg-white shadow-md rounded-lg">
          <table className="min-w-full table-auto text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-gray-200 text-left">
                <th className="py-3 px-4">Profile</th>
                <th className="py-3 px-4">Password</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-red-600 font-semibold">คะแนนที่ถูกหัก</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) =>
                editingId === user._id ? (
                  <tr key={user._id}>
                    <td colSpan={5}>
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
                  <tr key={user._id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 flex items-center gap-4">
                      <img
                        src={user.profileImage || "https://placehold.co/48x48?text=👤"}
                        alt="profile"
                        className="w-12 h-12 rounded-full object-cover border shadow"
                      />
                      <div>
                        <p className="font-medium text-gray-800">{user.username}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-700">{user.password}</td>
                    <td className="py-3 px-4 capitalize text-gray-700">{user.role}</td>
                    <td className="py-3 px-4 text-red-600 font-semibold">
                      {user.role === "student" ? `-${penalties[user._id] || 0}` : "-"}
                    </td>
                    <td className="py-3 px-4 flex gap-2">
                      <button
                        className="bg-yellow-500 text-white px-3 py-1.5 rounded hover:bg-yellow-600 text-xs sm:text-sm"
                        onClick={() => setEditingId(user._id)}
                      >
                        Edit
                      </button>
                      <button
                        className="bg-red-500 text-white px-3 py-1.5 rounded hover:bg-red-600 text-xs sm:text-sm"
                        onClick={() => handleDelete(user._id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard