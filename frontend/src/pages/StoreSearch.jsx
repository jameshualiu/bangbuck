import { useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Map from '../components/Map'
import Navbar from '../components/Navbar'
import api from '../api'

function chainName(storeName) {
  return storeName
    .replace(/\s+#\d+.*$/, '')
    .replace(/\s+-\s+.*$/, '')
    .trim()
}

export default function StoreSearch() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const { stores = [], lat, lng, zip_code, locationLabel } = state || {}

  const [selected, setSelected] = useState(() => new Set(stores.map(s => s.slug)))
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedMore, setExpandedMore] = useState(false)
  const [moreSearch, setMoreSearch] = useState('')

  const topChains = useMemo(() => {
    const map = new Map()
    for (const s of stores) {
      const name = chainName(s.store_name)
      if (!map.has(name)) {
        map.set(name, { chainName: name, slugs: [], closestMile: s.distance_miles ?? Infinity })
      }
      const entry = map.get(name)
      entry.slugs.push(s.slug)
      if (s.distance_miles != null && s.distance_miles < entry.closestMile) {
        entry.closestMile = s.distance_miles
      }
    }
    return [...map.values()]
      .sort((a, b) => a.closestMile - b.closestMile)
      .slice(0, 4)
      .map(c => ({ ...c, count: c.slugs.length }))
  }, [stores])

  const otherStores = useMemo(() => {
    const topSlugs = new Set(topChains.flatMap(c => c.slugs))
    return stores
      .filter(s => !topSlugs.has(s.slug))
      .sort((a, b) => (a.distance_miles ?? Infinity) - (b.distance_miles ?? Infinity))
  }, [stores, topChains])

  const center = [lat || 40.7128, lng || -74.006]

  function toggleStore(slug) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(slug) ? next.delete(slug) : next.add(slug)
      return next
    })
  }

  function toggleChain(chain) {
    setSelected(prev => {
      const next = new Set(prev)
      const allSelected = chain.slugs.every(slug => next.has(slug))
      if (allSelected) {
        chain.slugs.forEach(slug => next.delete(slug))
      } else {
        chain.slugs.forEach(slug => next.add(slug))
      }
      return next
    })
  }

  function saveRecentLocation() {
    const entry = { locationLabel, zip_code, lat, lng, stores }
    try {
      const raw = localStorage.getItem('bangbuck_recent_locations')
      const prev = raw ? JSON.parse(raw) : []
      const deduped = prev.filter(l => l.zip_code !== zip_code)
      localStorage.setItem('bangbuck_recent_locations', JSON.stringify([entry, ...deduped].slice(0, 5)))
    } catch {}
  }

  async function handleSearch() {
    if (!query.trim()) { setError('Enter a food item to search.'); return }
    const slugs = [...selected]
    if (!slugs.length) { setError('Select at least one store.'); return }
    setError('')
    setLoading(true)
    try {
      const { data: results } = await api.post('/search', { query: query.trim(), zip_code, slugs })
      saveRecentLocation()
      navigate('/results', { state: { results, query: query.trim(), locationLabel, zip_code, slugs } })
    } catch {
      setError('Search failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: '#f1ebff' }}>
      <Navbar />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map pane */}
        <div className="flex-1 relative border-r overflow-hidden" style={{ borderColor: '#cbb2fe' }}>
          <Map
            center={center}
            markerPos={center}
            stores={stores}
            selectedSlugs={selected}
            lightTheme
            className="w-full h-full"
            style={{ borderRadius: 0 }}
          />
          {/* Location chip */}
          <div
            className="absolute left-[18px] bottom-[18px] z-[400] text-[11px] px-[10px] py-[6px] rounded-[8px]"
            style={{
              fontFamily: "'SF Mono', ui-monospace, monospace",
              color: '#2a2356',
              backgroundColor: 'rgba(255,255,255,0.85)',
            }}
          >
            {stores.length} stores · {locationLabel || 'Nearby'}
          </div>
        </div>

        {/* Control panel */}
        <div
          className="shrink-0 overflow-y-auto px-7 py-8 flex flex-col"
          style={{ width: '380px', backgroundColor: '#f1ebff' }}
        >
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-[26px] font-bold tracking-[-0.02em]" style={{ color: '#2a2356' }}>
                {locationLabel || 'Nearby'}
              </h1>
              <p className="text-[14px] mt-[6px]" style={{ color: '#8a86b8' }}>
                {stores.length} stores found
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-[13px] font-semibold transition-opacity hover:opacity-70 shrink-0 mt-1"
              style={{ color: '#524d8a' }}
            >
              ← Back
            </button>
          </div>

          {/* Store multiselect */}
          <p className="text-[12px] font-semibold mt-7 mb-3" style={{ color: '#8a86b8' }}>
            Select stores to search
          </p>
          <div className="grid grid-cols-2 gap-2">
            {stores.map(s => {
              const active = selected.has(s.slug)
              return (
                <button
                  key={s.slug}
                  role="checkbox"
                  aria-checked={active}
                  onClick={() => toggleStore(s.slug)}
                  className="px-3 py-2 rounded-[10px] text-[13px] text-left transition-colors"
                  style={active
                    ? { border: '1px solid #4f51a8', backgroundColor: 'rgba(79,81,168,0.08)', color: '#2a2356' }
                    : { border: '1px solid #cbb2fe', backgroundColor: '#ffffff', color: '#8a86b8' }
                  }
                >
                  <span className="font-semibold block truncate">{s.store_name}</span>
                  {s.distance_miles != null && (
                    <span className="block text-[11px]" style={{ color: '#aaa4cf' }}>
                      {s.distance_miles} mi
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Search field */}
          <p className="text-[12px] font-semibold mt-7 mb-2" style={{ color: '#8a86b8' }}>
            What are you shopping for?
          </p>
          <div
            className="flex items-center gap-[10px] rounded-[12px] border px-[14px] py-[13px] bg-white"
            style={{ borderColor: '#cbb2fe' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7" stroke="#8a86b8" strokeWidth="2" />
              <path d="M20 20l-3-3" stroke="#8a86b8" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="e.g. greek yogurt"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="flex-1 text-[14px] bg-transparent outline-none placeholder:text-[#aaa4cf]"
              style={{ color: '#2a2356' }}
            />
          </div>

          {error && (
            <p className="text-[13px] mt-4" style={{ color: '#c25c5c' }}>{error}</p>
          )}

          {/* CTA */}
          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full mt-8 py-[15px] rounded-[12px] text-[15px] font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#4f51a8', color: '#f1ebff' }}
          >
            {loading ? 'Searching stores…' : 'Search →'}
          </button>
        </div>
      </div>
    </div>
  )
}
