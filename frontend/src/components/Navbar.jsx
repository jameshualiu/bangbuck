import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export function getUserInitials() {
  const token = localStorage.getItem('token')
  if (!token) return 'U'
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const sub = (payload.sub || '').toUpperCase()
    return sub.slice(0, 2) || 'U'
  } catch {
    return 'U'
  }
}

export default function Navbar({ center, savedCount = 0 }) {
  const navigate = useNavigate()
  const isLoggedIn = !!localStorage.getItem('token')
  const initials = getUserInitials()
  const [avatarOpen, setAvatarOpen] = useState(false)
  const avatarRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function logout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <header
      className="sticky top-0 z-40 bg-white border-b shrink-0"
      style={{ borderColor: '#e1d5fb', height: '72px', position: 'relative' }}
    >
      <div className="flex items-center h-full px-7">
        {/* Logo */}
        <Link
          to="/"
          className="text-[22px] font-extrabold shrink-0"
          style={{ color: '#2a2356', textDecoration: 'none' }}
        >
          BangBuck
        </Link>

        {/* Optional centered slot (e.g. search bar on /results) */}
        {center && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              maxWidth: '520px',
            }}
          >
            {center}
          </div>
        )}

        {/* Right cluster */}
        <div className="flex items-center gap-3 ml-auto shrink-0">
          <button
            onClick={() => navigate(isLoggedIn ? '/list' : '/login')}
            className="inline-flex items-center gap-2 h-[38px] px-[14px] rounded-full border transition-colors bg-[#f5f1ff] hover:bg-[#ece4ff]"
            style={{ borderColor: '#e1d5fb', color: '#524d8a', fontSize: '13.5px', fontWeight: 600 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
            </svg>
            Saved
            {savedCount > 0 && (
              <span className="text-white text-[11px] font-bold px-[6px] py-[2px] rounded-full" style={{ backgroundColor: '#4f51a8' }}>
                {savedCount}
              </span>
            )}
          </button>

          {isLoggedIn ? (
            <div ref={avatarRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setAvatarOpen(o => !o)}
                aria-label="Account menu"
                aria-expanded={avatarOpen}
                className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-white text-[14px] font-bold"
                style={{ background: 'linear-gradient(135deg, #ddbdfc, #757bc8)' }}
              >
                {initials}
              </button>
              {avatarOpen && (
                <div
                  className="absolute bg-white rounded-[12px] border"
                  style={{
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '148px',
                    borderColor: '#cbb2fe',
                    boxShadow: '0 12px 28px rgba(42,35,86,0.18)',
                  }}
                >
                  <button
                    onClick={() => { setAvatarOpen(false); logout() }}
                    className="w-full text-left px-4 py-3 text-[13px] font-medium rounded-[12px] transition-colors hover:bg-[#f5f1ff]"
                    style={{ color: '#524d8a' }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="h-[38px] px-[14px] inline-flex items-center rounded-full text-[13.5px] font-semibold transition-colors hover:bg-[#ece4ff]"
              style={{ color: '#4f51a8', textDecoration: 'none' }}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
