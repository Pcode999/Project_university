import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const SignupPage = () => {
  const navigate = useNavigate()
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [uploadedImageURL, setUploadedImageURL] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<string>('student')

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const preview = URL.createObjectURL(file)
    setPreviewImage(preview)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("http://localhost:8000/upload-profile-image", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()
      if (res.ok && data.image_url) {
        setUploadedImageURL(data.image_url)
      } else {
        setError("Upload image failed.")
      }
    } catch (err) {
      console.error("Upload error:", err)
      setError("Image upload failed.")
    }
  }

  const handleSignup = async () => {
    const username = (document.getElementById("username") as HTMLInputElement).value.trim()
    const email = (document.getElementById("email") as HTMLInputElement).value.trim()
    const password = (document.getElementById("password") as HTMLInputElement).value.trim()

    if (!username || !email || !password || !role) {
      setError("Please fill in all fields.")
      return
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address.")
      return
    }

    const payload = {
      username,
      email,
      password,
      profileImage: uploadedImageURL || "https://placehold.co/112x112?text=Avatar",
      role,
    }

    try {
      const response = await fetch("http://localhost:8000/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        // ✅ ดาวน์โหลดภาพหลังจากสมัครแล้ว (บอก backend ทำด้วย)
        await fetch("http://localhost:8000/startup_refresh") // เรียก endpoint ที่จะโหลดรูปเข้า images ใหม่

        alert("Signup successful!")
        navigate("/")
      } else {
        const data = await response.json()
        setError(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail))
      }
    } catch (error) {
      console.error("Error:", error)
      setError("Connection error.")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form className="bg-white p-8 rounded shadow-md w-full max-w-md flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-6 text-center text-green-700">Sign Up</h1>

        {error && (
          <p className="text-red-600 mb-4 text-center">
            {typeof error === 'string' ? error : JSON.stringify(error)}
          </p>
        )}

        <div className="mb-6 w-full flex flex-col items-center">
          <div className="relative w-28 h-28">
            <img
              src={previewImage || 'https://placehold.co/112x112?text=Avatar'}
              alt="Profile preview"
              className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-md ring-2 ring-green-400"
            />
            <label
              htmlFor="profileImage"
              className="absolute bottom-0 right-0 bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded-full cursor-pointer shadow"
            >
              Edit
            </label>
            <input
              id="profileImage"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">Upload profile picture</p>
        </div>

        <div className="mb-4 w-full">
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            type="text"
            id="username"
            className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-green-500"
            placeholder="Choose a username"
          />
        </div>

        <div className="mb-4 w-full">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-green-500"
            placeholder="Enter your email"
          />
        </div>

        <div className="mb-4 w-full">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            id="password"
            className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-green-500"
            placeholder="Create a password"
          />
        </div>

        <div className="mb-6 w-full">
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-green-500"
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleSignup}
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
        >
          Sign Up
        </button>

        <p className="text-center text-sm text-gray-600 mt-4">
          Already have an account?{' '}
          <button type="button" onClick={() => navigate('/')} className="text-green-600 hover:underline">
            Login
          </button>
        </p>
      </form>
    </div>
  )
}

export default SignupPage
