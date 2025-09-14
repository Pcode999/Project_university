import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, User, Mail, Lock, Shield, Eye, EyeOff } from 'lucide-react'

const SignupPage = () => {
  const navigate = useNavigate()
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploadedImageURL, setUploadedImageURL] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<string>('student')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  })

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const preview = URL.createObjectURL(file)
    setPreviewImage(preview)

    const formData = new FormData()
    formData.append("file", file)

    try {
      setIsLoading(true)
      setUploadedImageURL("http://localhost:8000/static/" + file.name)
      setFile(file)
    } catch (err) {
      console.error("Upload error:", err)
      setError("Image upload failed.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  const handleSignup = async () => {
    const { username, email, password } = formData

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
      setIsLoading(true)
      const response = await fetch("http://localhost:8000/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const form = new FormData()
      if (file) {
        form.append("file", file)
      }
      const sendImage = await fetch("http://localhost:8000/upload-profile-image", {
        method: "POST",
        body: form,
      })



      if (response.ok && sendImage.ok) {
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
    } finally {
      setIsLoading(false)
    }
  }

  const getRoleIcon = (roleValue: string) => {
    switch (roleValue) {
      case 'student': return '🎓'
      case 'teacher': return '👨‍🏫'
      case 'admin': return '👑'
      default: return '👤'
    }
  }

  const getRoleColor = (roleValue: string) => {
    switch (roleValue) {
      case 'student': return 'from-blue-500 to-cyan-500'
      case 'teacher': return 'from-green-500 to-emerald-500'
      case 'admin': return 'from-purple-500 to-pink-500'
      default: return 'from-gray-500 to-gray-600'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-emerald-400/20 to-teal-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-cyan-400/20 to-blue-400/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Main form card */}
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl mb-4 shadow-lg">
              <User className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Join Us Today
            </h1>
            <p className="text-gray-600 mt-2">Create your account to get started</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-700 text-sm text-center font-medium">{error}</p>
            </div>
          )}

          {/* Profile image upload */}
          <div className="mb-8 flex flex-col items-center">
            <div className="relative group">
              <div className={`w-32 h-32 rounded-full bg-gradient-to-r ${getRoleColor(role)} p-1 shadow-xl transition-all duration-300 group-hover:scale-105`}>
                <div className="w-full h-full bg-white rounded-full p-2">
                  <img
                    src={previewImage || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=112&h=112&fit=crop&crop=face`}
                    alt="Profile preview"
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </div>
              
              <label
                htmlFor="profileImage"
                className="absolute bottom-2 right-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white p-3 rounded-full cursor-pointer shadow-lg transition-all duration-300 hover:scale-110"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Camera className="w-5 h-5" />
                )}
              </label>
              
              <input
                id="profileImage"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                disabled={isLoading}
              />
            </div>
            
            <p className="text-sm text-gray-500 mt-3 font-medium">Upload your profile picture</p>
          </div>

          {/* Form fields */}
          <div className="space-y-6">
            {/* Username */}
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 bg-gray-50 hover:bg-white"
                  placeholder="Choose a username"
                />
              </div>
            </div>

            {/* Email */}
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 bg-gray-50 hover:bg-white"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="w-full pl-12 pr-12 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 bg-gray-50 hover:bg-white"
                  placeholder="Create a secure password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Role */}
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Your Role
              </label>
              <div className="relative">
                <Shield className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 bg-gray-50 hover:bg-white appearance-none cursor-pointer"
                >
                  <option value="student">🎓 Student</option>
                  <option value="teacher">👨‍🏫 Teacher</option>
                  <option value="admin">👑 Admin</option>
                </select>
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-400"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="button"
            onClick={handleSignup}
            disabled={isLoading}
            className="w-full mt-8 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-4 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Creating Account...
              </div>
            ) : (
              <span className="flex items-center justify-center">
                <span className="mr-2">{getRoleIcon(role)}</span>
                Create Account
              </span>
            )}
          </button>

          {/* Login link */}
          <div className="text-center mt-6">
            <p className="text-gray-600">
              Already have an account?{' '}
              <button 
                type="button" 
                onClick={() => navigate('/')}
                className="text-emerald-600 hover:text-emerald-700 font-semibold transition-colors hover:underline"
              >
                Sign in here
              </button>
            </p>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="text-center mt-6">
          <p className="text-gray-500 text-sm">
            By signing up, you agree to our{' '}
            <a href="#" className="text-emerald-600 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-emerald-600 hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default SignupPage