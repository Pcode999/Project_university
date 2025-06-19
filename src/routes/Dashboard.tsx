import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import MainContent from '../components/MainContent'

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-gray-200">
      <Header />
      <div className="flex flex-col md:flex-row">
        {/* 🔁 เมนูอยู่บนมือถือ และอยู่ด้านข้างเมื่อจอใหญ่ */}
        <Sidebar />
        <MainContent />
      </div>
    </div>
  )
}

export default Dashboard
