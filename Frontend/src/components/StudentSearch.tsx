import { useEffect, useState } from "react";

const API_BASE_URL = "http://localhost:8000";

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

const StudentSearch = () => {
  const [sleepList, setSleepList] = useState<{ name: string; time: string }[]>([]);

  useEffect(() => {
    const getSleepList = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/who-sleeping`);
        const data = await res.json();

        if (data.list) {
          const seen = new Set<string>();
          const unique = data.list.filter((item: { name: string; time: string }) => {
            if (seen.has(item.name)) return false;
            seen.add(item.name);
            return true;
          });
          setSleepList(unique);
        }
      } catch (e) {
        console.error("Error fetching sleep list:", e);
      }
    };

    getSleepList();
    const id = setInterval(getSleepList, 3000);
    return () => clearInterval(id);
  }, []);

  const handleDelete = async (index: number) => {
    try {
      await fetch(`${API_BASE_URL}/who-sleeping`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sleepList[index].name }),
      });
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
    a.href = url;
    a.download = `sleep-list-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-5xl bg-white p-4 sm:p-6 rounded-2xl shadow-lg my-6 sm:my-8 mx-auto border border-emerald-100">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold">Sleeping List</h2>
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
