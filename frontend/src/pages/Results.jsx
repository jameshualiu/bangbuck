import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import Navbar from '../components/Navbar'
import api from '../api'

const TIERS = {
  'ELITE FUEL':        { color: '#4f9e6a', label: 'Elite',     range: '0.80–1.00' },
  'SOLID CHOICE':      { color: '#5d83bd', label: 'Solid',     range: '0.50–0.79' },
  'BUDGET COMPROMISE': { color: '#bb9043', label: 'Budget',    range: '0.20–0.49' },
  'USE SPARINGLY':     { color: '#c2724a', label: 'Sparingly', range: '0.00–0.19' },
  'PROCESSED TRAP':    { color: '#c25c5c', label: 'Trap',      range: 'below 0'   },
}

const TIER_ORDER = ['ELITE FUEL', 'SOLID CHOICE', 'BUDGET COMPROMISE', 'USE SPARINGLY', 'PROCESSED TRAP']

const SORT_OPTIONS = [
  { key: 'score',   label: 'Best value score' },
  { key: 'protein', label: 'Protein per serving' },
  { key: 'density', label: 'Protein per calorie' },
  { key: 'cost',    label: 'Cheapest $/g protein' },
]

function sortResults(results, sort) {
  const copy = [...results]
  switch (sort) {
    case 'protein':
      return copy.sort((a, b) => (b.protein_per_100g || 0) - (a.protein_per_100g || 0))
    case 'density':
      return copy.sort((a, b) => {
        const ra = a.calories_per_100g ? (a.protein_per_100g || 0) / a.calories_per_100g : 0
        const rb = b.calories_per_100g ? (b.protein_per_100g || 0) / b.calories_per_100g : 0
        return rb - ra
      })
    case 'cost':
      return copy.sort((a, b) => (a.price_per_protein_gram || 0) - (b.price_per_protein_gram || 0))
    default:
      return copy.sort((a, b) => (b.score || 0) - (a.score || 0))
  }
}

export default function Results() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const { results: initialResults = [], query: initialQuery = '', locationLabel = '', zip_code, slugs = [] } = state || {}

  const [results, setResults] = useState(initialResults)
  const [query, setQuery] = useState(initialQuery)
  const [sort, setSort] = useState('score')
  const [selectedTiers, setSelectedTiers] = useState(new Set())
  const [locOpen, setLocOpen] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [searching, setSearching] = useState(false)
  const locRef = useRef(null)

  const recentLocations = (() => {
    try {
      const raw = localStorage.getItem('bangbuck_recent_locations')
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })()

  useEffect(() => {
    function handleClick(e) {
      if (locRef.current && !locRef.current.contains(e.target)) setLocOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const tierCounts = TIER_ORDER.reduce((acc, t) => {
    acc[t] = results.filter(r => r.tier === t).length
    return acc
  }, {})

  const filtered = sortResults(
    selectedTiers.size > 0 ? results.filter(r => selectedTiers.has(r.tier)) : results,
    sort
  )

  async function handleSearch() {
    if (!query.trim()) return
    setSearching(true)
    try {
      const { data } = await api.post('/search', { query: query.trim(), zip_code, slugs })
      setResults(data)
      setSelectedTiers(new Set())
    } catch {
      // keep existing results on failure
    } finally {
      setSearching(false)
    }
  }

  function toggleTier(tier) {
    setSelectedTiers(prev => {
      const next = new Set(prev)
      if (next.has(tier)) next.delete(tier)
      else next.add(tier)
      return next
    })
  }

  const centerSlot = (
    <div className="flex items-center gap-2">
      {/* Search input */}
      <div
        className="flex-1 flex items-center gap-2 px-[14px] py-[10px] rounded-[12px] border"
        style={{ backgroundColor: '#f5f1ff', borderColor: '#cbb2fe' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2a2356" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          disabled={searching}
          placeholder="Search for a food item…"
          className="flex-1 text-[14px] bg-transparent outline-none placeholder:text-[#aaa4cf] disabled:opacity-50"
          style={{ color: '#2a2356' }}
        />
        {searching && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a86b8" strokeWidth="2" strokeLinecap="round" className="animate-spin" style={{ flexShrink: 0 }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        )}
      </div>

      {/* Location button */}
      <div ref={locRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setLocOpen(o => !o)}
          aria-label="Change location"
          aria-expanded={locOpen}
          className="flex items-center justify-center rounded-[12px] border transition-colors"
          style={{
            width: '42px', height: '42px',
            ...(locOpen
              ? { backgroundColor: '#ece4ff', borderColor: '#4f51a8' }
              : { backgroundColor: '#f5f1ff', borderColor: '#cbb2fe' })
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#524d8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
        </button>
        {locOpen && (
          <div
            className="absolute bg-white rounded-[14px] border"
            style={{ top: 'calc(100% + 8px)', right: 0, width: '260px', zIndex: 50, borderColor: '#cbb2fe', boxShadow: '0 16px 36px rgba(42,35,86,0.24)' }}
          >
            <p className="text-[11px] font-bold tracking-[0.06em] uppercase px-4 pt-4 pb-2" style={{ color: '#aaa4cf' }}>
              SHOPPING NEAR
            </p>
            <button
              className="w-full text-left px-4 py-3 text-[13px] font-semibold flex items-center justify-between transition-colors hover:bg-[#f5f1ff]"
              style={{ color: '#2a2356' }}
              onClick={() => setLocOpen(false)}
            >
              <span className="truncate pr-2">{locationLabel || 'Current location'}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4f51a8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>

            {recentLocations.filter(l => l.zip_code !== zip_code).length > 0 && (
              <>
                <div className="border-t mx-4 mt-1 mb-1" style={{ borderColor: '#ece4ff' }} />
                <p className="text-[11px] font-bold tracking-[0.06em] uppercase px-4 pt-2 pb-1" style={{ color: '#aaa4cf' }}>
                  RECENT
                </p>
                {recentLocations.filter(l => l.zip_code !== zip_code).map(loc => (
                  <button
                    key={loc.zip_code}
                    className="w-full text-left px-4 py-[9px] text-[13px] font-medium flex items-center gap-2 transition-colors hover:bg-[#f5f1ff]"
                    style={{ color: '#524d8a' }}
                    onClick={() => {
                      setLocOpen(false)
                      navigate('/stores', { state: { stores: loc.stores, lat: loc.lat, lng: loc.lng, zip_code: loc.zip_code, locationLabel: loc.locationLabel } })
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}>
                      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                    <span className="truncate">{loc.locationLabel || loc.zip_code}</span>
                  </button>
                ))}
              </>
            )}

            <div className="border-t mx-4 mt-1" style={{ borderColor: '#ece4ff' }} />
            <button
              className="w-full text-left px-4 py-3 pb-4 text-[13px] font-medium transition-colors hover:bg-[#f5f1ff]"
              style={{ color: '#4f51a8' }}
              onClick={() => { setLocOpen(false); navigate('/') }}
            >
              New location →
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: '#f5f1ff' }}>
      <Navbar center={centerSlot} savedCount={savedCount} />

      {/* Body: sidebar + main */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside
          className="w-[300px] bg-white shrink-0 border-r overflow-y-auto flex flex-col gap-6 px-[22px] py-6"
          style={{ borderColor: '#e1d5fb' }}
        >
          {/* Sort */}
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.06em] mb-3" style={{ color: '#aaa4cf' }}>
              SORT BY
            </p>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Sort by">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  role="radio"
                  aria-checked={sort === opt.key}
                  tabIndex={0}
                  onClick={() => setSort(opt.key)}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSort(opt.key)}
                  className="text-[13px] font-semibold px-[14px] py-[9px] rounded-[10px] text-left transition-colors"
                  style={sort === opt.key
                    ? { backgroundColor: '#ddbdfc', color: '#2a2356' }
                    : { backgroundColor: '#f5f1ff', color: '#8a86b8' }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tier filter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: '#aaa4cf' }}>
                VALUE TIER
              </p>
              {selectedTiers.size > 0 && (
                <button
                  onClick={() => setSelectedTiers(new Set())}
                  className="text-[12px] font-semibold"
                  style={{ color: '#4f51a8' }}
                >
                  Clear
                </button>
              )}
            </div>

            {results.length > 0 && (
              <div className="flex gap-[2px] h-[9px] rounded-[6px] overflow-hidden mb-3">
                {TIER_ORDER.filter(t => tierCounts[t] > 0).map(t => (
                  <div
                    key={t}
                    className="rounded-sm"
                    style={{ flex: tierCounts[t], backgroundColor: TIERS[t].color }}
                  />
                ))}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <button
                role="checkbox"
                aria-checked={selectedTiers.size === 0}
                aria-label={`All foods, ${results.length} foods${selectedTiers.size === 0 ? ', selected' : ''}`}
                tabIndex={0}
                onClick={() => setSelectedTiers(new Set())}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelectedTiers(new Set())}
                className="flex items-center gap-2 text-[13px] font-semibold px-[11px] py-[9px] rounded-[10px] text-left transition-colors"
                style={selectedTiers.size === 0
                  ? { border: '1px solid #4f51a8', backgroundColor: 'rgba(79,81,168,0.08)', color: '#2a2356' }
                  : { border: '1px solid transparent', color: '#2a2356' }
                }
              >
                <span className="flex-1">All foods</span>
                <span style={{ opacity: 0.55, color: '#2a2356' }}>{results.length}</span>
              </button>

              {TIER_ORDER.filter(t => tierCounts[t] > 0).map(t => {
                const active = selectedTiers.has(t)
                const { color, label } = TIERS[t]
                return (
                  <button
                    key={t}
                    role="checkbox"
                    aria-checked={active}
                    aria-label={`${label}, ${tierCounts[t]} foods${active ? ', selected' : ''}`}
                    tabIndex={0}
                    onClick={() => toggleTier(t)}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggleTier(t)}
                    className="flex items-center gap-2 text-[13px] font-semibold px-[11px] py-[9px] rounded-[10px] text-left transition-colors"
                    style={active
                      ? { border: `1px solid ${color}`, backgroundColor: `${color}1e`, color: '#2a2356' }
                      : { border: '1px solid transparent', color: '#2a2356' }
                    }
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="flex-1">{label}</span>
                    <span style={{ opacity: 0.55, color: '#2a2356' }}>{tierCounts[t]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Score explainer */}
          <div className="rounded-[14px] border p-4" style={{ backgroundColor: '#f5f1ff', borderColor: '#e1d5fb' }}>
            <p className="text-[13px] font-bold mb-2" style={{ color: '#2a2356' }}>
              What the value score means
            </p>
            <p className="text-[11.5px] leading-[1.5] mb-3" style={{ color: '#8a86b8' }}>
              A 0–1 score balancing protein you get against what you pay — penalised for excess sugar and heavy processing.
            </p>
            <div className="flex flex-col gap-1.5 mb-3">
              {TIER_ORDER.map(t => (
                <div key={t} className="flex items-center justify-between gap-2">
                  <span
                    className="inline-block text-white text-[9px] font-extrabold tracking-[0.02em] px-2 py-[3px] rounded-[7px]"
                    style={{ backgroundColor: TIERS[t].color }}
                  >
                    {TIERS[t].label}
                  </span>
                  <span className="text-[10.5px]" style={{ color: '#aaa4cf' }}>{TIERS[t].range}</span>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t" style={{ borderColor: '#ece4ff' }}>
              <p className="text-[11px]" style={{ color: '#8a86b8' }}>
                <strong>Quick read:</strong> aim for ~1g protein per 10–15 cal, and protein higher than sugar.
              </p>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto px-7 py-6 pb-10">
          <div className="mb-5">
            <h1 className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: '#2a2356' }}>
              High-protein picks near {locationLabel || 'you'}
            </h1>
            <p className="text-[13px] mt-1" aria-live="polite" style={{ color: '#8a86b8' }}>
              {selectedTiers.size > 0
                ? `${filtered.length} of ${results.length} foods · ${selectedTiers.size} tier${selectedTiers.size > 1 ? 's' : ''} selected`
                : `${results.length} foods ranked · per 100g`
              }
            </p>
          </div>

          {selectedTiers.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-[18px]">
              <span className="text-[12px] font-semibold" style={{ color: '#8a86b8' }}>Filtered by</span>
              {[...selectedTiers].map(t => (
                <button
                  key={t}
                  aria-label={`Remove filter ${TIERS[t]?.label}`}
                  tabIndex={0}
                  onClick={() => toggleTier(t)}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggleTier(t)}
                  className="inline-flex items-center gap-[7px] text-[12px] font-semibold px-[10px] py-[5px] rounded-full transition-opacity hover:opacity-70"
                  style={{
                    color: '#2a2356',
                    backgroundColor: `${TIERS[t]?.color}24`,
                    border: `1px solid ${TIERS[t]?.color}66`,
                  }}
                >
                  <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ backgroundColor: TIERS[t]?.color }} />
                  {TIERS[t]?.label}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M2 2l6 6M8 2l-6 6" />
                  </svg>
                </button>
              ))}
              <button
                onClick={() => setSelectedTiers(new Set())}
                className="text-[12px] font-semibold"
                style={{ color: '#4f51a8' }}
              >
                Clear all
              </button>
            </div>
          )}

          {results.length === 0 ? (
            <p style={{ color: '#8a86b8' }}>
              No results found. Try a different search term or select more stores.
            </p>
          ) : filtered.length === 0 ? (
            <div
              className="flex flex-col items-center text-center rounded-[16px] border py-14 px-6"
              style={{ backgroundColor: 'white', borderColor: '#e1d5fb' }}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#ece4ff' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4f51a8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <h3 className="text-[17px] font-bold mb-1" style={{ color: '#2a2356' }}>No foods in these tiers</h3>
              <p className="mb-4" style={{ color: '#8a86b8' }}>Try selecting different tiers or clearing filters.</p>
              <button
                onClick={() => setSelectedTiers(new Set())}
                className="text-[13px] font-bold px-5 py-2.5 rounded-[11px] text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#4f51a8' }}
              >
                Show all foods
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filtered.map((r, i) => (
                <ProductCard key={i} result={r} onSave={() => setSavedCount(c => c + 1)} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
