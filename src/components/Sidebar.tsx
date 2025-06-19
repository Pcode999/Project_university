const Sidebar = () => {
  return (
    <nav className="w-full bg-white p-4 shadow md:w-64 md:min-h-screen">
      <ul className="flex flex-row justify-around md:flex-col md:space-y-4 text-sm">
        <li className="text-green-600 font-medium hover:underline cursor-pointer">🏠 Home</li>
        <li className="text-red-600 font-medium hover:underline cursor-pointer">🗑 Delete</li>
        <li className="text-blue-600 font-medium hover:underline cursor-pointer">🔄 Refresh</li>
        <li className="text-orange-600 font-medium hover:underline cursor-pointer">🚪 Logout</li>
      </ul>
    </nav>
  )
}

export default Sidebar
