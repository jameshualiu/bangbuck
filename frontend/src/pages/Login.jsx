import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      localStorage.setItem('token', data.access_token)
      navigate('/')
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Invalid email or password.')
      } else {
        setError('Could not reach server. Try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#f1ebff' }}>
      <div
        className="w-full max-w-sm rounded-[20px] p-8 bg-white border"
        style={{ borderColor: '#e1d5fb', boxShadow: '0 16px 36px rgba(42,35,86,0.10)' }}
      >
        <h1 className="text-[26px] font-extrabold tracking-[-0.02em] mb-1" style={{ color: '#2a2356' }}>
          BangBuck
        </h1>
        <p className="text-[14px] mb-6" style={{ color: '#8a86b8' }}>Sign in to your account</p>
        {error && <p className="text-[13px] mb-4" style={{ color: '#c25c5c' }}>{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-[14px] py-[13px] rounded-[12px] border text-[14px] bg-white outline-none transition-colors focus:border-[#4f51a8] placeholder:text-[#aaa4cf]"
            style={{ borderColor: '#cbb2fe', color: '#2a2356' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-[14px] py-[13px] rounded-[12px] border text-[14px] bg-white outline-none transition-colors focus:border-[#4f51a8] placeholder:text-[#aaa4cf]"
            style={{ borderColor: '#cbb2fe', color: '#2a2356' }}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-[14px] rounded-[12px] text-[15px] font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#4f51a8', color: '#f1ebff' }}
          >
            {isLoading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="text-[14px] text-center mt-4" style={{ color: '#8a86b8' }}>
          No account?{' '}
          <Link to="/register" className="font-semibold hover:underline" style={{ color: '#4f51a8' }}>Register</Link>
        </p>
      </div>
    </div>
  )
}
