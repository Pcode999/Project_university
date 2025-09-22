import { useEffect, useState } from "react";
import { API_URL } from "../constant/constant";
import CourseSelector from "./CourseSelector";

const API_BASE_URL = API_URL;

type StreamStatus = {
  is_streaming: boolean;
  status: {
    label: string | null;
    confidence: number | null;
    faces: string[];
    per_eye?: { eye: "left" | "right"; label: string; conf: number }[];
    timestamp: number | null;
    snapshot?: string | null;
  };
};

type SleepListItem = {
  name: string;
  time: string;
  user_id?: string;
};

const StudentSearch = () => {
  const [sleepList, setSleepList] = useState<SleepListItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedCourseName, setSelectedCourseName] = useState<string | null>(null);
  const [isFromCourse, setIsFromCourse] = useState(false);

  useEffect(() => {
    const getSleepList = async () => {
      try {
        let url = `${API_BASE_URL}who-sleeping`;
        
        // If a course is selected, fetch sleeping students from that course
        if (selectedCourseId) {
          url += `?course_id=${selectedCourseId}`;
        }
        
        const res = await fetch(url);
        const data = await res.json();

        if (selectedCourseId) {
          // Handle course-specific response
          if (data.sleeping_students) {
            const courseStudents = data.sleeping_students.map((student: any) => ({
              name: student.name,
              time: student.added_to_course || "Unknown time",
              user_id: student.user_id
            }));
            setSleepList(courseStudents);
            setSelectedCourseName(data.course_name);
            setIsFromCourse(true);
          } else {
            setSleepList([]);
            setIsFromCourse(true);
          }
        } else {
          // Handle recent detections response
          if (data.recent_detections) {
            const seen = new Set<string>();
            const unique = data.recent_detections.filter((item: { name: string; time: string }) => {
              if (seen.has(item.name)) return false;
              seen.add(item.name);
              return true;
            });
            setSleepList(unique);
            setIsFromCourse(false);
          } else {
            setSleepList([]);
            setIsFromCourse(false);
          }
        }
      } catch (e) {
        console.error("Error fetching sleep list:", e);
      }
    };

    getSleepList();
    const id = setInterval(getSleepList, 3000);
    return () => clearInterval(id);
  }, [selectedCourseId]);

  const handleDelete = async (index: number) => {
    try {
      const student = sleepList[index];
      
      if (isFromCourse && selectedCourseId && student.user_id) {
        // Remove from course sleeping list
        await fetch(`${API_BASE_URL}who-sleeping/course/${selectedCourseId}/student/${student.user_id}`, {
          method: "DELETE"
        });
      } else {
        // Remove from recent detections
        await fetch(`${API_BASE_URL}who-sleeping`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: student.name }),
        });
      }
      
      // ลบออกจาก UI ทันที
      setSleepList(prev => prev.filter((_, i) => i !== index));
    } catch (e) {
      console.error(e);
    }
  };

  const exportToCSV = () => {
    if (sleepList.length === 0) return;
    const headers = ["name", "time"];
    const escapeCSV = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
    const rows = sleepList.map(r => [escapeCSV(r.name), escapeCSV(r.time)].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const coursePrefix = selectedCourseName ? `${selectedCourseName.replace(/[^a-zA-Z0-9]/g, '-')}-` : '';
    a.href = url;
    a.download = `${coursePrefix}sleep-list-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCourseSelect = (courseId: string | null) => {
    setSelectedCourseId(courseId);
    if (!courseId) {
      setSelectedCourseName(null);
      setIsFromCourse(false);
    }
  };

  return (
    <div className="w-full max-w-5xl bg-white p-4 sm:p-6 rounded-2xl shadow-lg my-6 sm:my-8 mx-auto border border-emerald-100">
      {/* Course Selection Section */}
      <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
        <CourseSelector
          selectedCourseId={selectedCourseId}
          onCourseSelect={handleCourseSelect}
          className="mb-2"
        />
        <div className="text-xs text-blue-600 mt-2">
          {selectedCourseId ? (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Showing sleeping students from course: {selectedCourseName}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Showing recent sleep detections from live streaming
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold">
          {isFromCourse ? `Sleeping List - ${selectedCourseName}` : 'Recent Sleep Detections'}
        </h2>
        <button
          onClick={exportToCSV}
          disabled={sleepList.length === 0}
          className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium border transition
            ${
              sleepList.length === 0
                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                : "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
            }`}
        >
          Export to Excel
        </button>
      </div>

      {/* Mobile: card list */}
      <div className="md:hidden space-y-3">
        {sleepList.length === 0 ? (
          <div className="text-center text-gray-500 py-6 border border-gray-200 rounded-xl">No records</div>
        ) : (
          sleepList.map((item, idx) => (
            <div key={`${item.name}-${item.time}-${idx}`} className="rounded-xl border border-gray-200 p-4 flex items-start justify-between">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-gray-500 text-sm mt-1">{item.time}</p>
              </div>
              <button
                onClick={() => handleDelete(idx)}
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Time</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {sleepList.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                  No records
                </td>
              </tr>
            ) : (
              sleepList.map((item, index) => (
                <tr key={`${item.name}-${item.time}-${index}`} className="border-t border-gray-100">
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3">{item.time}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(index)}
                      className="px-3 py-1.5 rounded-md text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentSearch;
