import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const SignupPage = () => {
  const navigate = useNavigate()

  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const imageURL = URL.createObjectURL(file)
      setPreviewImage(imageURL)
    }
  }

  const handleSignup = () => {
    // สามารถส่งข้อมูลและรูปภาพไป backend ที่นี่
    navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form className="bg-white p-8 rounded shadow-md w-full max-w-md flex flex-col items-center">
        <h1 className="text-3xl font-bold mb-6 text-center text-green-700">Sign Up</h1>

        {/* ✅ Profile Image Upload (ตกแต่งแล้ว) */}
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

        {/* ✅ Username */}
        <div className="mb-4 w-full">
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            type="text"
            id="username"
            className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Choose a username"
          />
        </div>

        {/* ✅ Email */}
        <div className="mb-4 w-full">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            id="email"
            className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Enter your email"
          />
        </div>

        {/* ✅ Password */}
        <div className="mb-6 w-full">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            id="password"
            className="w-full border border-gray-300 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Create a password"
          />
        </div>

        {/* ✅ Sign Up Button */}
        <button
          type="button"
          onClick={handleSignup}
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
        >
          Sign Up
        </button>

        {/* ✅ Back to Login */}
        <p className="text-center text-sm text-gray-600 mt-4">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-green-600 hover:underline"
          >
            Login
          </button>
        </p>
      </form>
    </div>
  )
}

export default SignupPage
