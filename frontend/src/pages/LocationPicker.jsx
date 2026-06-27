import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Map from '../components/Map'
import Navbar from '../components/Navbar'
import api from '../api'

const RADIUS_OPTIONS = [1, 3, 5, 10, 25]

export default function LocationPicker() {
  const [center, setCenter] = useState([40.7128, -74.006])
  const [markerPos, setMarkerPos] = useState(null)
  const [label, setLabel] = useState('')
  const [textInput, setTextInput] = useState('')
  const [radiusIndex, setRadiusIndex] = useState(2) // default 5 mi
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const radius = RADIUS_OPTIONS[radiusIndex]
  const radiusMeters = radius * 1609.34
  const sliderPct = (radiusIndex / (RADIUS_OPTIONS.length - 1)) * 100
  const sliderTrack = `linear-gradient(to right, #4f51a8 0%, #4f51a8 ${sliderPct}%, #ece4ff ${sliderPct}%, #ece4ff 100%)`

  async function reverseGeocode(lat, lng) {
    try {
      const params = new URLSearchParams({ lat, lon: lng, format: 'json', zoom: 14 })
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
        headers: { 'User-Agent': 'BangBuck/1.0' },
      })
      const data = await r.json()
      const a = data.address || {}
      return a.neighbourhood || a.suburb || a.city_district || a.city || a.town || ''
    } catch {
      return ''
    }
  }

  async function handleMapClick({ lat, lng }) {
    setMarkerPos([lat, lng])
    setCenter([lat, lng])
    const lbl = await reverseGeocode(lat, lng)
    setLabel(lbl)
    if (lbl) setTextInput(lbl)
  }

  async function handleFindStores() {
    setError('')
    setLoading(true)
    try {
      let lat, lng
      if (markerPos && textInput.trim() === label) {
        // Pin was placed by clicking the map and text wasn't changed — use exact pin coords
        ;[lat, lng] = markerPos
      } else if (textInput.trim()) {
        // User typed a location manually — geocode it
        const params = new URLSearchParams({ q: textInput.trim(), format: 'json', limit: 1 })
        const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { 'User-Agent': 'BangBuck/1.0' },
        })
        const results = await r.json()
        if (!results.length) {
          setError('Location not found. Try a different search.')
          return
        }
        lat = parseFloat(results[0].lat)
        lng = parseFloat(results[0].lon)
        setCenter([lat, lng])
        setMarkerPos([lat, lng])
      } else {
        setError('Click the map or type a location to get started.')
        return
      }

      const zipParams = new URLSearchParams({ lat, lon: lng, format: 'json' })
      const zipResp = await fetch(`https://nominatim.openstreetmap.org/reverse?${zipParams}`, {
        headers: { 'User-Agent': 'BangBuck/1.0' },
      })
      const zipData = await zipResp.json()
      const zip_code = zipData.address?.postcode || '10001'

      const { data: stores } = await api.post('/stores/find', { lat, lng, zip_code, radius_miles: radius })
      if (!stores.length) {
        setError(`No stores found within ${radius} miles.`)
        return
      }

      navigate('/stores', {
        state: { stores, lat, lng, zip_code, locationLabel: textInput.trim() || label },
      })
    } catch (err) {
      setError('Failed to find stores. Try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const locationDisplay = textInput.trim() || label || 'Click the map or type below'

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: '#f1ebff' }}>
      <Navbar />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map pane */}
        <div className="flex-1 relative border-r overflow-hidden" style={{ borderColor: '#cbb2fe' }}>
          <Map
            center={center}
            markerPos={markerPos}
            onMapClick={handleMapClick}
            lightTheme
            radiusMeters={markerPos ? radiusMeters : 0}
            className="w-full h-full"
            style={{ borderRadius: 0 }}
          />
          {/* Radius label chip */}
          <div
            className="absolute left-[18px] bottom-[18px] z-[400] text-[11px] px-[10px] py-[6px] rounded-[8px]"
            style={{
              fontFamily: "'SF Mono', ui-monospace, monospace",
              color: '#2a2356',
              backgroundColor: 'rgba(255,255,255,0.85)',
            }}
          >
            {radius} mi radius{label ? ` · ${label}` : ''}
          </div>
        </div>

        {/* Control panel */}
        <div
          className="shrink-0 overflow-y-auto px-7 py-8"
          style={{ width: '380px', backgroundColor: '#f1ebff' }}
        >
          <h1 className="text-[26px] font-bold tracking-[-0.02em]" style={{ color: '#2a2356' }}>
            Find the best protein value
          </h1>
          <p className="text-[14px] mt-[6px] mb-[26px]" style={{ color: '#8a86b8' }}>
            Drop a pin or search your neighborhood
          </p>

          {/* Location field */}
          <label className="block text-[12px] font-semibold mb-2" style={{ color: '#8a86b8' }}>
            Location
          </label>
          <div
            className="flex items-center gap-[10px] rounded-[12px] border px-[14px] py-[13px] bg-white"
            style={{ borderColor: '#cbb2fe' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" stroke="#757bc8" strokeWidth="2" strokeLinejoin="round" />
              <circle cx="12" cy="10" r="2.4" stroke="#757bc8" strokeWidth="2" />
            </svg>
            <input
              type="text"
              placeholder="Address, neighborhood, or ZIP"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFindStores()}
              className="flex-1 text-[14px] bg-transparent outline-none placeholder:text-[#aaa4cf]"
              style={{ color: '#2a2356' }}
            />
          </div>

          {/* Radius slider */}
          <div className="flex items-baseline justify-between mt-7 mb-3">
            <span className="text-[13px]" style={{ color: '#8a86b8' }}>Search radius</span>
            <span className="text-[18px] font-bold" style={{ color: '#2a2356' }}>{radius} mi</span>
          </div>
          <input
            type="range"
            min="0"
            max={RADIUS_OPTIONS.length - 1}
            step="1"
            value={radiusIndex}
            onChange={e => setRadiusIndex(Number(e.target.value))}
            className="w-full"
            style={{ background: sliderTrack }}
          />
          <div className="flex justify-between mt-[9px]">
            {RADIUS_OPTIONS.map((r, i) => (
              <span
                key={r}
                className="text-[11px] font-medium cursor-pointer"
                style={{ color: i === radiusIndex ? '#4f51a8' : '#aaa4cf' }}
                onClick={() => setRadiusIndex(i)}
              >
                {r} mi
              </span>
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="text-[13px] mt-4" style={{ color: '#c25c5c' }}>{error}</p>
          )}

          {/* CTA */}
          <button
            onClick={handleFindStores}
            disabled={loading}
            className="w-full mt-8 py-[15px] rounded-[12px] text-[15px] font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#4f51a8', color: '#f1ebff' }}
          >
            {loading ? 'Finding stores…' : 'Find Stores →'}
          </button>
        </div>
      </div>
    </div>
  )
}
