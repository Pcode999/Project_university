import React, { useState, useEffect } from "react";

const API_BASE_URL = "http://localhost:8000/";

interface Student {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  display_name: string;
}

interface User {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  display_name: string;
}

interface CourseStudentManagementProps {
  courseId: string;
  courseName: string;
  onClose: () => void;
}

const CourseStudentManagement: React.FC<CourseStudentManagementProps> = ({
  courseId,
  courseName,
  onClose,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Fetch course students
  const fetchCourseStudents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}courses/${courseId}/students`);
      if (response.ok) {
        const data = await response.json();
        setStudents(data.students || []);
      }
    } catch (error) {
      console.error("Error fetching course students:", error);
    }
  };

  // Fetch available users
  const fetchAvailableUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}users/available`);
      if (response.ok) {
        const data = await response.json();
        setAvailableUsers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching available users:", error);
    }
  };

  // Add student to course
  const addStudent = async () => {
    if (!selectedUserId) {
      setMessage("กรุณาเลือกนักเรียนที่จะเพิ่ม");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}courses/${courseId}/students`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: selectedUserId }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ เพิ่ม ${data.display_name} เข้าคอร์สเรียบร้อย`);
        setSelectedUserId("");
        fetchCourseStudents();
      } else {
        setMessage(`❌ ${data.detail}`);
      }
    } catch (error) {
      setMessage("❌ เกิดข้อผิดพลาดในการเพิ่มนักเรียน");
      console.error("Error adding student:", error);
    } finally {
      setLoading(false);
    }
  };

  // Remove student from course
  const removeStudent = async (userId: string, displayName: string) => {
    if (!confirm(`คุณต้องการลบ ${displayName} ออกจากคอร์สหรือไม่?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}courses/${courseId}/students/${userId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ ลบ ${data.display_name} ออกจากคอร์สเรียบร้อย`);
        fetchCourseStudents();
      } else {
        setMessage(`❌ ${data.detail}`);
      }
    } catch (error) {
      setMessage("❌ เกิดข้อผิดพลาดในการลบนักเรียน");
      console.error("Error removing student:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourseStudents();
    fetchAvailableUsers();
  }, [courseId]);

  // Filter available users (exclude students already in course)
  const filteredUsers = availableUsers.filter(
    (user) => !students.some((student) => student.user_id === user.user_id)
  );

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-gray-900/80 to-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl shadow-2xl border border-emerald-200 p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto mx-4 transform transition-all duration-300">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-gradient-to-r from-emerald-200 to-green-200">
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-4 rounded-2xl">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
              👥 จัดการสมาชิกคอร์ส
            </h2>
            <p className="text-emerald-700 font-medium text-lg mt-1">{courseName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl hover:from-red-600 hover:to-red-700 text-2xl font-bold shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-200 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">ℹ️</span>
              </div>
              <p className="text-emerald-800 font-medium">{message}</p>
            </div>
          </div>
        )}

        {/* Add Student Section */}
        <div className="mb-8 p-6 bg-gradient-to-r from-emerald-50 via-green-50 to-emerald-50 rounded-3xl border-2 border-emerald-200 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center">
              <span className="text-white text-lg">➕</span>
            </div>
            <h3 className="text-xl font-bold text-emerald-800">เพิ่มนักเรียนเข้าคอร์ส</h3>
          </div>
          <div className="flex gap-4">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 p-4 border-2 border-emerald-300 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500 bg-white shadow-md text-gray-700 font-medium transition-all duration-200"
              disabled={loading}
            >
              <option value="">-- เลือกนักเรียนที่จะเพิ่ม --</option>
              {filteredUsers.map((user) => (
                <option key={user.user_id} value={user.user_id}>
                  {user.display_name} ({user.email})
                </option>
              ))}
            </select>
            <button
              onClick={addStudent}
              disabled={loading || !selectedUserId}
              className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-2xl hover:from-emerald-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  กำลังเพิ่ม...
                </>
              ) : (
                <>
                  <span>➕</span>
                  เพิ่มนักเรียน
                </>
              )}
            </button>
          </div>
        </div>

        {/* Students List */}
        <div className="bg-gradient-to-br from-gray-50 to-emerald-50 rounded-3xl p-6 border-2 border-emerald-100 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center">
              <span className="text-white text-lg">👥</span>
            </div>
            <h3 className="text-2xl font-bold text-emerald-800">
              นักเรียนในคอร์ส ({students.length} คน)
            </h3>
          </div>
          
          {students.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gradient-to-r from-gray-200 to-emerald-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl text-gray-400">👤</span>
              </div>
              <p className="text-gray-500 text-lg font-medium">ยังไม่มีนักเรียนในคอร์สนี้</p>
              <p className="text-gray-400 text-sm mt-2">เพิ่มนักเรียนคนแรกเพื่อเริ่มต้นใช้งาน</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              {students.map((student, index) => (
                <div
                  key={student.user_id}
                  className="flex items-center justify-between p-5 bg-white rounded-2xl shadow-md hover:shadow-lg border border-emerald-100 hover:border-emerald-200 transition-all duration-200 transform hover:scale-[1.02]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-emerald-400 to-green-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {student.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-lg">
                        {student.display_name}
                      </h4>
                      <p className="text-emerald-600 font-medium text-sm">{student.email}</p>
                      <p className="text-gray-500 text-xs mt-1">
                        Username: {student.username}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                      #{index + 1}
                    </div>
                    <button
                      onClick={() => removeStudent(student.user_id, student.display_name)}
                      disabled={loading}
                      className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-bold rounded-xl hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
                    >
                      <span>🗑️</span>
                      ลบออก
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t-2 border-emerald-100 flex justify-between items-center">
          <div className="text-emerald-600 font-medium">
            <span className="text-2xl">📚</span> ระบบจัดการสมาชิกคอร์ส
          </div>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-2xl hover:from-gray-600 hover:to-gray-700 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
          >
            <span>✖️</span>
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseStudentManagement;
