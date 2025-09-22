import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, User, Mail, Lock, Shield, Eye, EyeOff } from 'lucide-react'
import { API_URL } from '../constant/constant'

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
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    password: ''
  })
  
  const [validationErrors, setValidationErrors] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    password: '',
    profileImage: ''
  })
  
  const [touched, setTouched] = useState({
    first_name: false,
    last_name: false,
    username: false,
    email: false,
    password: false,
    profileImage: false
  })

  // Validation functions
  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'first_name':
        if (!value.trim()) return 'First name is required'
        if (value.trim().length < 2) return 'First name must be at least 2 characters'
        if (!/^[a-zA-Z\s]+$/.test(value)) return 'First name can only contain letters and spaces'
        return ''
      
      case 'last_name':
        if (!value.trim()) return 'Last name is required'
        if (value.trim().length < 2) return 'Last name must be at least 2 characters'
        if (!/^[a-zA-Z\s]+$/.test(value)) return 'Last name can only contain letters and spaces'
        return ''
      
      case 'username':
        if (!value.trim()) return 'Username is required'
        if (value.length < 3) return 'Username must be at least 3 characters'
        if (value.length > 20) return 'Username must be less than 20 characters'
        if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Username can only contain letters, numbers, and underscore'
        return ''
      
      case 'email':
        if (!value.trim()) return 'Email is required'
        if (!/\S+@\S+\.\S+/.test(value)) return 'Please enter a valid email address'
        return ''
      
      case 'password':
        if (!value) return 'Password is required'
        if (value.length < 8) return 'Password must be at least 8 characters'
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) return 'Password must contain at least one lowercase letter, one uppercase letter, and one number'
        return ''
      
      default:
        return ''
    }
  }

  const validateProfileImage = (): string => {
    if (!file && !previewImage) return 'Profile image is required'
    if (file) {
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) return 'Image size must be less than 5MB'
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
      if (!allowedTypes.includes(file.type)) return 'Only JPEG, PNG, and GIF images are allowed'
    }
    return ''
  }

  const validateAllFields = (): boolean => {
    const newErrors = {
      first_name: validateField('first_name', formData.first_name),
      last_name: validateField('last_name', formData.last_name),
      username: validateField('username', formData.username),
      email: validateField('email', formData.email),
      password: validateField('password', formData.password),
      profileImage: validateProfileImage()
    }
    
    setValidationErrors(newErrors)
    return !Object.values(newErrors).some(error => error !== '')
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Mark field as touched and validate image
    setTouched(prev => ({ ...prev, profileImage: true }))
    
    // Validate file before processing
    const maxSize = 5 * 1024 * 1024 // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
    
    if (file.size > maxSize) {
      setValidationErrors(prev => ({ ...prev, profileImage: 'Image size must be less than 5MB' }))
      return
    }
    
    if (!allowedTypes.includes(file.type)) {
      setValidationErrors(prev => ({ ...prev, profileImage: 'Only JPEG, PNG, and GIF images are allowed' }))
      return
    }

    // Clear any previous validation errors
    setValidationErrors(prev => ({ ...prev, profileImage: '' }))
    
    const preview = URL.createObjectURL(file)
    setPreviewImage(preview)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const url = API_URL + "static/" + file.name
      setIsLoading(true)
      setUploadedImageURL(url)
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
    setTouched(prev => ({ ...prev, [field]: true }))
    
    // Real-time validation
    const fieldError = validateField(field, value)
    setValidationErrors(prev => ({ ...prev, [field]: fieldError }))
    
    if (error) setError(null)
  }

  const handleSignup = async () => {
    // Mark all fields as touched
    setTouched({
      first_name: true,
      last_name: true,
      username: true,
      email: true,
      password: true,
      profileImage: true
    })

    // Validate all fields
    if (!validateAllFields()) {
      setError("Please fix all validation errors before submitting.")
      return
    }

    if (!role) {
      setError("Please select a role.")
      return
    }

    const { first_name, last_name, username, email, password } = formData

    const payload = {
      first_name,
      last_name,
      username,
      email,
      password,
      profileImage: uploadedImageURL || "https://placehold.co/112x112?text=Avatar",
      role,
    }

    try {
      setIsLoading(true)
      const url = await API_URL + "signup"
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const signupData = await response.json()
        const userId = signupData.user_id

        // Upload image with user_id if file exists
        let imageUploadSuccess = true
        if (file) {
          const form = new FormData()
          form.append("file", file)
          const sendImage = await fetch(API_URL + `upload-profile-image/${userId}`, {
            method: "POST",
            body: form,
          })
          imageUploadSuccess = sendImage.ok
        }

        if (imageUploadSuccess) {
          // ✅ ดาวน์โหลดภาพหลังจากสมัครแล้ว (บอก backend ทำด้วย)
          await fetch(API_URL + "startup_refresh") // เรียก endpoint ที่จะโหลดรูปเข้า images ใหม่

          alert("Signup successful!")
          navigate("/")
        } else {
          setError("User created but image upload failed")
        }
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

  const getFieldError = (field: string): string => {
    return touched[field as keyof typeof touched] ? validationErrors[field as keyof typeof validationErrors] : ''
  }

  const hasFieldError = (field: string): boolean => {
    return touched[field as keyof typeof touched] && validationErrors[field as keyof typeof validationErrors] !== ''
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
            {getFieldError('profileImage') && (
              <p className="mt-2 text-sm text-red-600 text-center">{getFieldError('profileImage')}</p>
            )}
          </div>

          {/* Form fields */}
          <div className="space-y-6">
            {/* First Name and Last Name Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* First Name */}
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  First Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    className={`w-full pl-12 pr-4 py-4 border rounded-xl focus:ring-2 focus:border-transparent transition-all duration-300 bg-gray-50 hover:bg-white ${
                      hasFieldError('first_name')
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-200 focus:ring-emerald-500'
                    }`}
                    placeholder="First name"
                  />
                </div>
                {getFieldError('first_name') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('first_name')}</p>
                )}
              </div>

              {/* Last Name */}
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Last Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    className={`w-full pl-12 pr-4 py-4 border rounded-xl focus:ring-2 focus:border-transparent transition-all duration-300 bg-gray-50 hover:bg-white ${
                      hasFieldError('last_name')
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-200 focus:ring-emerald-500'
                    }`}
                    placeholder="Last name"
                  />
                </div>
                {getFieldError('last_name') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('last_name')}</p>
                )}
              </div>
            </div>

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
                  className={`w-full pl-12 pr-4 py-4 border rounded-xl focus:ring-2 focus:border-transparent transition-all duration-300 bg-gray-50 hover:bg-white ${
                    hasFieldError('username')
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-200 focus:ring-emerald-500'
                  }`}
                  placeholder="Choose a username"
                />
              </div>
              {getFieldError('username') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('username')}</p>
              )}
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
                  className={`w-full pl-12 pr-4 py-4 border rounded-xl focus:ring-2 focus:border-transparent transition-all duration-300 bg-gray-50 hover:bg-white ${
                    hasFieldError('email')
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-200 focus:ring-emerald-500'
                  }`}
                  placeholder="Enter your email"
                />
              </div>
              {getFieldError('email') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('email')}</p>
              )}
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
                  className={`w-full pl-12 pr-12 py-4 border rounded-xl focus:ring-2 focus:border-transparent transition-all duration-300 bg-gray-50 hover:bg-white ${
                    hasFieldError('password')
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-200 focus:ring-emerald-500'
                  }`}
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
              {getFieldError('password') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('password')}</p>
              )}
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