import { useState } from "react";

type User = {
  _id: string;
  username: string;
  email: string;
  password: string;
  role: string;
  profileImage: string;
};

type EditUserFormProps = {
  user: User;
  onSave: () => void;
  onCancel: () => void;
};

const EditUserForm = ({ user, onSave, onCancel }: EditUserFormProps) => {
  const [formData, setFormData] = useState<User>({ ...user });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const res = await fetch("http://localhost:8000/upload-profile-image", {
        method: "POST",
        body: formDataUpload,
      });
      const data = await res.json();
      if (data.image_url) {
        setFormData(prev => ({ ...prev, profileImage: data.image_url }));
      }
    } catch (error) {
      console.error("Error uploading image:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/users/${user._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) onSave();
      else alert("Failed to save user");
    } catch (error) {
      console.error("Error saving user:", error);
      alert("Failed to save user");
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-800";
      case "teacher":
        return "bg-blue-100 text-blue-800";
      case "student":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return "👑";
      case "teacher":
        return "👨‍🏫";
      case "student":
        return "👨‍🎓";
      default:
        return "👤";
    }
  };

  return (
    <div className="fixed inset-0 bg-white bg-opacity-10 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-xl">✏️</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold">Edit User</h2>
                <p className="text-emerald-100 text-sm">Update user information</p>
              </div>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(
                formData.role
              )} bg-opacity-90`}
            >
              {getRoleIcon(formData.role)} {formData.role}
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-6">
          {/* Profile Image */}
          <div className="text-center">
            <label className="block text-sm font-semibold text-gray-700 mb-4">
              Profile Image
            </label>
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <img
                  src={formData.profileImage || "https://placehold.co/120x120?text=👤"}
                  className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 shadow-lg"
                  alt="Profile preview"
                />
                {isLoading && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
              <label className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-6 py-2 rounded-lg cursor-pointer transition-all duration-200 transform hover:scale-105 shadow-lg">
                📸 Choose Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  disabled={isLoading}
                />
              </label>
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">👤 Username</label>
              <input
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter username"
                className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors duration-200"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">📧 Email</label>
              <input
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email address"
                className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors duration-200"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">🔒 Password</label>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter password"
                className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors duration-200 font-mono"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">🎭 Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full border-2 border-gray-200 px-4 py-3 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors duration-200 bg-white"
                disabled={isLoading}
              >
                <option value="admin">👑 Admin</option>
                <option value="teacher">👨‍🏫 Teacher</option>
                <option value="student">👨‍🎓 Student</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-6 rounded-b-2xl">
          <div className="flex gap-4 justify-end">
            <button
              onClick={onCancel}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors duration-200 font-medium"
              disabled={isLoading}
            >
              ❌ Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </div>
              ) : (
                "💾 Save Changes"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditUserForm;
