import { useState } from "react";

type User = {
  _id: string;
  username: string;
  email: string;
  profileImage: string;
};

const StudentSearch = () => {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [penalty, setPenalty] = useState("");

  const handleSearch = async () => {
    if (!keyword) return;
    const res = await fetch(`http://localhost:8000/search-students?name=${keyword}`);
    const data = await res.json();
    setResults(data);
  };

  const handleSave = async () => {
    if (!penalty || results.length === 0) return;

    const student_id = results[0]._id;
    const created_at = new Date().toISOString();

    const res = await fetch("http://localhost:8000/behavior-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id,
        penalty: Number(penalty),
        created_at
      })
    });

    const data = await res.json();
    if (res.ok) {
      alert("✅ บันทึกพฤติกรรมสำเร็จแล้ว");
      setPenalty("");
    } else {
      alert("❌ บันทึกไม่สำเร็จ: " + data.detail);
    }
  };

  return (
    <div className="w-full max-w-4xl bg-white p-6 rounded-xl shadow-lg my-6 mx-auto border border-gray-200">
      <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
        🔍 ค้นหานักเรียน
      </h3>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          className="flex-1 px-4 h-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="พิมพ์ชื่อนักเรียน เช่น ภู..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <button
          onClick={handleSearch}
          className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition duration-200"
        >
          ค้นหา
        </button>
      </div>

      {results.length > 0 && (
        <>
          <ul className="space-y-4">
            {results.map((user) => (
              <li
                key={user._id}
                className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg shadow-sm hover:bg-blue-50 transition"
              >
                <img
                  src={user.profileImage || "https://placehold.co/48x48?text=👤"}
                  alt="profile"
                  className="w-12 h-12 rounded-full object-cover border shadow"
                />
                <div>
                  <p className="font-medium text-gray-800">{user.username}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t pt-5">
            <h4 className="text-lg font-semibold text-gray-800 mb-3">
              📌 บันทึกพฤติกรรม (หักคะแนน)
            </h4>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <input
                type="number"
                placeholder="หักคะแนน (เช่น 2)"
                value={penalty}
                onChange={(e) => setPenalty(e.target.value)}
                className="border border-gray-300 rounded-lg p-3 w-full focus:ring-2 focus:ring-red-400"
              />
              <button
                type="submit"
                className="sm:col-span-2 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition"
              >
                บันทึกพฤติกรรม
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default StudentSearch;