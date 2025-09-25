import { useState, useEffect } from "react";
import { API_URL } from "../constant/constant";
import CourseStudentManagement from "./CourseStudentManagement";

type Course = {
  _id: string;
  course_name: string;
  sleeping_students: string[];
  created_at: string;
  updated_at: string;
};

type User = {
  _id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  profileImage: string;
};

const CourseManagement = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCourse, setNewCourse] = useState({
    course_name: "",
  });
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showStudentManagement, setShowStudentManagement] = useState(false);

  const fetchCourses = async () => {
    try {
      const url = API_URL + "courses";
      const res = await fetch(url);
      const data = await res.json();
      setCourses(data);
    } catch {
      setError("Failed to fetch courses.");
    }
  };

  const fetchUsers = async () => {
    try {
      const url = API_URL + "users";
      const res = await fetch(url);
      const data = await res.json();
      setUsers(data);
    } catch {
      setError("Failed to fetch users.");
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchUsers();
  }, []);

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = API_URL + "courses";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newCourse),
      });
      if (res.ok) {
        fetchCourses();
        setShowAddForm(false);
        setNewCourse({ course_name: "" });
      } else {
        const errorData = await res.json();
        setError(errorData.detail || "Failed to create course.");
      }
    } catch {
      setError("Failed to create course.");
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      const url = API_URL + `courses/${courseId}`;
      const res = await fetch(url, {
        method: "DELETE",
      });
      if (res.ok) fetchCourses();
      else setError("Failed to delete course.");
    } catch {
      setError("Failed to delete course.");
    }
  };

  const openStudentManagement = (course: Course) => {
    setSelectedCourse(course);
    setShowStudentManagement(true);
  };

  const closeStudentManagement = () => {
    setSelectedCourse(null);
    setShowStudentManagement(false);
  };

  const getUserDisplayName = (userId: string) => {
    const user = users.find(u => u._id === userId);
    if (!user) return userId;
    return `${user.first_name} ${user.last_name}`.trim() || user.username;
  };


  return (
    <div className="space-y-6">
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-700 text-center font-medium">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-lg border border-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Courses</p>
              <p className="text-2xl font-bold text-gray-800">{courses.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <span className="text-blue-600 text-xl">📚</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-lg border border-red-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Students with Sleep Issues</p>
              <p className="text-2xl font-bold text-gray-800">
                {[...new Set(courses.flatMap(c => c.sleeping_students))].length}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-xl">
              <span className="text-red-600 text-xl">😴</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Course Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-6 py-3 rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-medium"
        >
          ➕ Add New Course
        </button>
      </div>

      {/* Add Course Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Add New Course</h3>
            <form onSubmit={handleAddCourse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Course Name
                </label>
                <input
                  type="text"
                  value={newCourse.course_name}
                  onChange={(e) => setNewCourse({...newCourse, course_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-500 text-white py-2 rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  Create Course
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewCourse({ course_name: "" });
                  }}
                  className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Courses Table/List */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">Course Management</h2>
          <p className="text-sm text-gray-500 mt-1">จัดการข้อมูลรายวิชาทั้งหมด</p>
        </div>

        {/* Mobile: Card list */}
        <div className="p-4 space-y-3 md:hidden">
          {courses.map((course) => (
            <div key={course._id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">{course.course_name}</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-600 shadow"
                    onClick={() => openStudentManagement(course)}
                  >
                    👥 จัดการสมาชิก
                  </button>
                  <button
                    className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-600 shadow"
                    onClick={() => handleDeleteCourse(course._id)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                <p><strong>Students with Sleep Issues:</strong> {course.sleeping_students.length}</p>
                {course.sleeping_students.length > 0 && (
                  <div className="mt-2">
                    <strong>Sleeping Students:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {course.sleeping_students.map((studentId) => (
                        <span
                          key={studentId}
                          className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs"
                        >
                          {getUserDisplayName(studentId)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gradient-to-r from-emerald-500 to-green-600 text-white">
                <th className="py-4 px-6 text-left font-semibold">Course Name</th>
                <th className="py-4 px-6 text-left font-semibold">Students with Sleep Issues</th>
                <th className="py-4 px-6 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {courses.map((course, index) => (
                <tr
                  key={course._id}
                  className={`transition-colors duration-200 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                  }`}
                >
                  <td className="py-4 px-6">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{course.course_name}</p>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div>
                      <span className="text-sm font-medium text-gray-800">
                        {course.sleeping_students.length} students
                      </span>
                      {course.sleeping_students.length > 0 && (
                        <div className="mt-2 max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {course.sleeping_students.slice(0, 3).map((studentId) => (
                              <span
                                key={studentId}
                                className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs"
                              >
                                {getUserDisplayName(studentId)}
                              </span>
                            ))}
                            {course.sleeping_students.length > 3 && (
                              <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                                +{course.sleeping_students.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex gap-2">
                      <button
                        className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg transform hover:scale-105"
                        onClick={() => openStudentManagement(course)}
                      >
                        👥 จัดการสมาชิก
                      </button>
                      <button
                        className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg transform hover:scale-105"
                        onClick={() => handleDeleteCourse(course._id)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Management Modal */}
      {showStudentManagement && selectedCourse && (
        <CourseStudentManagement
          courseId={selectedCourse._id}
          courseName={selectedCourse.course_name}
          onClose={closeStudentManagement}
        />
      )}
    </div>
  );
};

export default CourseManagement;
