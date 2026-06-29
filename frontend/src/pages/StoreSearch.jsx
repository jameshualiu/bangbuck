import { useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import StoreMap from '../components/Map'
import Navbar from '../components/Navbar'
import api from '../api'

// groupKey: strips branch numbers only — used for grouping stores into chains.
// Keeps the "Brand - Location" suffix so distinct sub-brands stay separate.
function groupKey(storeName) {
  return storeName
    .replace(/\s+#\d+.*$/, '')
    .trim()
}

// displayName: strips both the branch number and the location suffix for
// clean card labels (e.g. "Safeway #123 - Downtown" → "Safeway").
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

  const [selected, setSelected] = useState(() => new Set(stores.filter(s => s.distance_miles != null).map(s => s.slug)))
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedMore, setExpandedMore] = useState(false)
  const [moreSearch, setMoreSearch] = useState('')

  const topChains = useMemo(() => {
    const chainMap = new Map()
    for (const s of stores) {
      if (!s.store_name || !s.slug) continue
      const key = groupKey(s.store_name)
      if (!chainMap.has(key)) {
        chainMap.set(key, { chainName: chainName(s.store_name), slugs: [], closestMile: null })
      }
      const entry = chainMap.get(key)
      entry.slugs.push(s.slug)
      if (s.distance_miles != null && (entry.closestMile === null || s.distance_miles < entry.closestMile)) {
        entry.closestMile = s.distance_miles
      }
    }
    return [...chainMap.values()]
      .sort((a, b) => {
        if (a.closestMile === null && b.closestMile === null) return 0
        if (a.closestMile === null) return 1
        if (b.closestMile === null) return -1
        return a.closestMile - b.closestMile
      })
      .slice(0, 4)
      .map(c => ({ ...c, count: c.slugs.length }))
  }, [stores])

  const otherStores = useMemo(() => {
    const topSlugs = new Set(topChains.flatMap(c => c.slugs))
    return stores
      .filter(s => !topSlugs.has(s.slug))
      .sort((a, b) => {
        if (a.distance_miles === null && b.distance_miles === null) return 0
        if (a.distance_miles == null) return 1
        if (b.distance_miles == null) return -1
        return a.distance_miles - b.distance_miles
      })
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
          <StoreMap
            center={center}
            markerPos={center}
            stores={stores}
            selectedSlugs={selected}
            onStoreClick={toggleStore}
            showLabels
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

          {/* Top chains */}
          <p className="text-[12px] font-semibold mt-7 mb-3" style={{ color: '#8a86b8' }}>
            Select stores to search
          </p>
          <div className="grid grid-cols-2 gap-2">
            {topChains.map(chain => {
              const allSelected = chain.slugs.every(slug => selected.has(slug))
              const someSelected = !allSelected && chain.slugs.some(slug => selected.has(slug))
              return (
                <button
                  key={chain.slugs[0]}
                  role="checkbox"
                  aria-checked={allSelected ? true : someSelected ? 'mixed' : false}
                  onClick={() => toggleChain(chain)}
                  className="px-3 py-2 rounded-[10px] text-[13px] text-left transition-colors"
                  style={
                    allSelected
                      ? { border: '1.5px solid #4f51a8', backgroundColor: 'rgba(79,81,168,0.08)', color: '#2a2356' }
                      : someSelected
                      ? { border: '1.5px solid #4f51a8', backgroundColor: '#ffffff', color: '#2a2356' }
                      : { border: '1px solid #cbb2fe', backgroundColor: '#ffffff', color: '#8a86b8' }
                  }
                >
                  <span className="font-semibold flex items-center gap-1 truncate">
                    <span className="truncate">{chain.chainName}</span>
                    {someSelected && (
                      <span
                        className="w-[6px] h-[6px] rounded-full shrink-0"
                        style={{ backgroundColor: '#4f51a8' }}
                      />
                    )}
                  </span>
                  <span className="block text-[11px]" style={{ color: '#aaa4cf' }}>
                    {chain.count > 1 ? `${chain.count} locations` : '1 location'}
                    {chain.closestMile !== null ? ` · ${chain.closestMile} mi` : ''}
                  </span>
                </button>
              )
            })}
          </div>

          {/* View more stores expander */}
          {otherStores.length > 0 && (
            <div
              className="mt-3 rounded-[10px] overflow-hidden"
              style={{ border: '1px dashed #cbb2fe' }}
            >
              <button
                aria-expanded={expandedMore}
                onClick={() => {
                  if (expandedMore) setMoreSearch('')
                  setExpandedMore(v => !v)
                }}
                className="w-full flex items-center justify-between px-[14px] py-[10px] bg-transparent"
              >
                <span className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold" style={{ color: '#524d8a' }}>
                    View more stores ({otherStores.length})
                  </span>
                  {(() => {
                    const n = otherStores.filter(s => selected.has(s.slug)).length
                    return n > 0 ? (
                      <span
                        className="text-[11px] font-semibold px-[6px] py-[2px] rounded-full"
                        style={{ backgroundColor: 'rgba(79,81,168,0.1)', color: '#4f51a8' }}
                      >
                        {n} selected
                      </span>
                    ) : null
                  })()}
                </span>
                <span
                  className="text-[13px] transition-transform"
                  style={{ color: '#8a86b8', display: 'inline-block', transform: expandedMore ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  ↓
                </span>
              </button>

              {expandedMore && (
                <div style={{ borderTop: '1px solid #e8e0ff', backgroundColor: '#ffffff' }}>
                  {/* Search input */}
                  <div className="px-3 pt-3 pb-2">
                    <div
                      className="flex items-center gap-2 rounded-[8px] px-[10px] py-[7px]"
                      style={{ border: '1px solid #cbb2fe' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="11" cy="11" r="7" stroke="#aaa4cf" strokeWidth="2" />
                        <path d="M20 20l-3-3" stroke="#aaa4cf" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search stores…"
                        value={moreSearch}
                        onChange={e => setMoreSearch(e.target.value)}
                        className="flex-1 text-[13px] bg-transparent outline-none placeholder:text-[#aaa4cf]"
                        style={{ color: '#2a2356' }}
                      />
                    </div>
                  </div>

                  {/* Scrollable store list */}
                  <div className="overflow-y-auto px-3 pb-3" style={{ maxHeight: '180px' }}>
                    {otherStores
                      .filter(s =>
                        !moreSearch.trim() ||
                        s.store_name?.toLowerCase().includes(moreSearch.toLowerCase())
                      )
                      .map(s => (
                        <label
                          key={s.slug}
                          className="flex items-center gap-[10px] px-1 py-[6px] cursor-pointer rounded-[6px]"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(s.slug)}
                            onChange={() => toggleStore(s.slug)}
                            className="w-[14px] h-[14px] shrink-0"
                            style={{ accentColor: '#4f51a8' }}
                          />
                          <div>
                            <div className="text-[13px] font-medium" style={{ color: '#2a2356' }}>
                              {s.store_name}
                            </div>
                            {s.distance_miles != null && (
                              <div className="text-[11px]" style={{ color: '#aaa4cf' }}>
                                {s.distance_miles} mi
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

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
