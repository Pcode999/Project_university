import { Routes, Route } from 'react-router-dom'
import LoginPage from './routes/LoginPage'
import Dashboard from './routes/Dashboard'
import SignupPage from './routes/SignupPage' // 👈 import

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  )
}

export default App
