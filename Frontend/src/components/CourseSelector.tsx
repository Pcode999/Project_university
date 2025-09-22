import React, { useState, useEffect } from 'react';
import { API_URL } from '../constant/constant';

type Course = {
  _id: string;
  course_name: string;
  sleeping_students: string[];
  created_at: string;
  updated_at: string;
};

type CourseSelectorProps = {
  selectedCourseId: string | null;
  onCourseSelect: (courseId: string | null) => void;
  className?: string;
};

const CourseSelector: React.FC<CourseSelectorProps> = ({
  selectedCourseId,
  onCourseSelect,
  className = ""
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}courses`);
      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }
      const data = await response.json();
      setCourses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCourseChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    onCourseSelect(value === '' ? null : value);
  };

  const selectedCourse = courses.find(course => course._id === selectedCourseId);

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        Select Course for Sleep Detection
      </label>
      <div className="relative">
        <select
          value={selectedCourseId || ''}
          onChange={handleCourseChange}
          disabled={loading}
          className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed appearance-none"
        >
          <option value="">No course selected</option>
          {courses.map((course) => (
            <option key={course._id} value={course._id}>
              {course.course_name}
            </option>
          ))}
        </select>
        
        {/* Custom dropdown arrow */}
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* Status indicators */}
      <div className="flex items-center justify-between text-xs">
        {loading && (
          <span className="text-blue-600 flex items-center gap-1">
            <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            Loading courses...
          </span>
        )}
        
        {error && (
          <span className="text-red-600 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </span>
        )}
        
        {selectedCourse && (
          <span className="text-emerald-600 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Selected: {selectedCourse.course_name}
          </span>
        )}
        
        {!loading && !error && !selectedCourse && courses.length > 0 && (
          <span className="text-gray-500">
            {courses.length} courses available
          </span>
        )}
      </div>

      {/* Refresh button */}
      <button
        onClick={fetchCourses}
        disabled={loading}
        className="text-xs text-emerald-600 hover:text-emerald-700 underline disabled:text-gray-400 disabled:no-underline"
      >
        Refresh courses
      </button>
    </div>
  );
};

export default CourseSelector;
