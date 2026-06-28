import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import api from '../api'

const TIER_COLORS = {
  'ELITE FUEL':        '#4f9e6a',
  'SOLID CHOICE':      '#5d83bd',
  'BUDGET COMPROMISE': '#bb9043',
  'USE SPARINGLY':     '#c2724a',
  'PROCESSED TRAP':    '#c25c5c',
}

export default function ShoppingList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/list/items')
      .then(r => setItems(r.data))
      .catch(err => {
        if (err.response?.status === 401) navigate('/login')
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(id) {
    await api.delete(`/list/items/${id}`)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const total = items.reduce((sum, i) => sum + (i.price || 0), 0)

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f1ebff' }}>
      <Navbar />
      <div className="px-7 py-8 max-w-2xl mx-auto">

        {/* Heading */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <button
              onClick={() => navigate('/results')}
              className="text-[13px] font-medium mb-[10px] transition-colors hover:opacity-70"
              style={{ color: '#8a86b8', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              ← Back to results
            </button>
            <h1 className="text-[26px] font-bold tracking-[-0.02em]" style={{ color: '#2a2356' }}>
              Saved List
            </h1>
            <p className="text-[13px] mt-1" style={{ color: '#8a86b8' }}>
              {items.length} saved items
            </p>
          </div>
          {items.length > 0 && (
            <div className="text-right">
              <p className="text-[11px]" style={{ color: '#aaa4cf' }}>Cart total</p>
              <p className="text-[20px] font-bold" style={{ color: '#2a2356' }}>
                ${total.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {loading && <p style={{ color: '#8a86b8' }}>Loading…</p>}

        {!loading && items.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[14px] mb-4" style={{ color: '#8a86b8' }}>Your list is empty.</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 rounded-[12px] text-[14px] font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#4f51a8', color: '#f1ebff' }}
            >
              Find foods →
            </button>
          </div>
        )}

        <div className="flex flex-col gap-[10px]">
          {items.map(item => (
            <div
              key={item.id}
              className="rounded-[14px] border p-[14px] flex items-start gap-3 bg-white"
              style={{ borderColor: '#e1d5fb', boxShadow: '0 1px 3px rgba(42,35,86,0.07)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[14px] leading-[1.3]" style={{ color: '#2a2356' }}>
                  {item.product_name.length > 55 ? item.product_name.slice(0, 55) + '…' : item.product_name}
                </p>
                <p className="text-[12px] mt-[3px]" style={{ color: '#8a86b8' }}>{item.store_name}</p>
                {item.price != null && (
                  <p className="text-[13px] font-semibold mt-[5px]" style={{ color: '#524d8a' }}>
                    ${item.price.toFixed(2)}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                {item.tier && (
                  <span
                    className="text-white text-[9px] font-extrabold tracking-[0.02em] px-2 py-1 rounded-[7px]"
                    style={{ backgroundColor: TIER_COLORS[item.tier] || '#8a86b8' }}
                  >
                    {item.tier}
                  </span>
                )}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-[12px] transition-opacity hover:opacity-70"
                  style={{ color: '#aaa4cf' }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
