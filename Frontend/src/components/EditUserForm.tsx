import { useState } from "react"

type User = {
  _id: string
  username: string
  email: string
  password: string
  role: string
  profileImage: string
  totalPenalty?: number // เพิ่มเฉพาะสำหรับการแก้ไข
}

type EditUserFormProps = {
  user: User
  onSave: () => void
  onCancel: () => void
}

const EditUserForm = ({ user, onSave, onCancel }: EditUserFormProps) => {
  const [formData, setFormData] = useState<User>({ ...user })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === "totalPenalty" ? parseInt(value) || 0 : value
    }))
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formDataUpload = new FormData()
    formDataUpload.append("file", file)

    const res = await fetch("http://localhost:8000/upload-profile-image", {
      method: "POST",
      body: formDataUpload,
    })
    const data = await res.json()
    if (data.image_url) {
      setFormData((prev) => ({ ...prev, profileImage: data.image_url }))
    }
  }

  const handleSubmit = async () => {
    const res = await fetch(`http://localhost:8000/users/${user._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    })

    // 👉 เพิ่มส่วนส่งคะแนนแยกไป API อื่น (ถ้ามี)
    if (res.ok && formData.role === "student") {
      if (formData.totalPenalty !== undefined) {
        await fetch(`http://localhost:8000/override-penalty/${user._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ totalPenalty: formData.totalPenalty })
        })
      }
      onSave()
    } else if (res.ok) {
      onSave()
    } else {
      alert("Failed to save user")
    }
  }

  return (
    <div className="p-4 bg-yellow-50 border rounded shadow-md">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Profile Image
        </label>
        <div className="flex items-center gap-4">
          <img
            src={formData.profileImage || "https://placehold.co/48x48?text=👤"}
            className="w-12 h-12 rounded-full object-cover border"
            alt="preview"
          />
          <label className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded cursor-pointer border text-sm">
            Choose Image
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <input
          name="username"
          value={formData.username}
          onChange={handleChange}
          placeholder="Username"
          className="border px-3 py-2 rounded"
        />
        <input
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email"
          className="border px-3 py-2 rounded"
        />
        <input
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Password"
          className="border px-3 py-2 rounded font-mono"
        />
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          className="border px-3 py-2 rounded"
        >
          <option value="admin">admin</option>
          <option value="teacher">teacher</option>
          <option value="student">student</option>
        </select>

        {formData.role === "student" && (
          <input
            name="totalPenalty"
            type="number"
            value={formData.totalPenalty || 0}
            onChange={handleChange}
            placeholder="คะแนนที่ถูกหัก"
            className="border px-3 py-2 rounded col-span-2"
          />
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default EditUserForm