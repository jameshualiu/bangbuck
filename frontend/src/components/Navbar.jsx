import { Link, useNavigate } from 'react-router-dom'

export default function Navbar() {
  const navigate = useNavigate()

  function logout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <nav
      className="bg-white border-b flex items-center justify-between px-7 py-3"
      style={{ borderColor: '#e1d5fb' }}
    >
      <Link to="/" className="text-[20px] font-extrabold" style={{ color: '#2a2356' }}>
        BangBuck
      </Link>
      <div className="flex items-center gap-4">
        <Link
          to="/list"
          className="text-sm font-semibold transition-colors hover:opacity-70"
          style={{ color: '#524d8a' }}
        >
          Saved
        </Link>
        <button
          onClick={logout}
          className="text-sm transition-colors hover:opacity-70"
          style={{ color: '#8a86b8' }}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
