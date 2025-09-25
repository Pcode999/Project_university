import { Routes, Route, Navigate } from "react-router-dom"
import LoginPage from "./routes/LoginPage"
import Dashboard from "./routes/Dashboard"
import SignupPage from "./routes/SignupPage"
import StudentDashboard from "./routes/StudentDashborad"
import AdminDashboard from "./routes/AdminDashboard"

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/StudentDashboard" element={<StudentDashboard />} />
      <Route path="/AdminDashboard" element={<AdminDashboard />} />
    </Routes>
  )
}

export default App