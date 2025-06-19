
const Header = () => {
  return (
    <header className="bg-blue-800 text-white p-4 flex items-center justify-between">
      <h1 className="text-2xl font-bold">Sleep Detector</h1>
      <div className="flex items-center space-x-2">
        <div className="w-10 h-10 rounded-full bg-white"></div>
        <p>Hello, <span className="font-semibold">admin</span></p>
      </div>
    </header>
  )
}

export default Header
