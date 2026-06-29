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
  const [geoLoading, setGeoLoading] = useState(false)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)
  const abortRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      abortRef.current?.abort()
    }
  }, [])

  const radius = RADIUS_OPTIONS[radiusIndex]
  const radiusMeters = radius * 1609.34
  const sliderPct = (radiusIndex / (RADIUS_OPTIONS.length - 1)) * 100
  const sliderTrack = `linear-gradient(to right, #4f51a8 0%, #4f51a8 ${sliderPct}%, #ece4ff ${sliderPct}%, #ece4ff 100%)`

  function getRecentLocations() {
    try {
      const raw = localStorage.getItem('bangbuck_recent_locations')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  function handleFocus() {
    if (textInput.trim().length >= 2) {
      if (suggestions.length) setShowDropdown(true)
      return
    }
    const recents = getRecentLocations()
    if (!recents.length) return
    setSuggestions(
      recents.map(r => ({
        kind: 'recent',
        label: r.locationLabel,
        subtitle: r.zip_code,
        lat: r.lat,
        lng: r.lng,
      }))
    )
    setShowDropdown(true)
  }

  function handleBlur() {
    clearTimeout(debounceRef.current)
    // Delay so a mousedown on a dropdown item fires before the dropdown closes
    setTimeout(() => setShowDropdown(false), 150)
  }

  async function fetchNominatimSuggestions(query) {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    try {
      const params = new URLSearchParams({ q: query, format: 'json', addressdetails: 1, limit: 5 })
      const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'User-Agent': 'BangBuck/1.0' },
        signal: abortRef.current.signal,
      })
      const results = await r.json()
      if (!results.length) { setShowDropdown(false); return }
      setSuggestions(
        results.map(res => ({
          kind: 'nominatim',
          label: res.display_name.split(',').slice(0, 2).join(',').trim(),
          subtitle: [res.type, res.address?.state || res.address?.country]
            .filter(Boolean)
            .join(' · '),
          lat: parseFloat(res.lat),
          lng: parseFloat(res.lon),
        }))
      )
      setShowDropdown(true)
    } catch (err) {
      if (err.name !== 'AbortError') setShowDropdown(false)
    }
  }

  function handleInputChange(e) {
    const val = e.target.value
    setTextInput(val)
    setActiveIndex(-1)

    clearTimeout(debounceRef.current)

    if (val.trim().length < 2) {
      const recents = getRecentLocations()
      if (recents.length) {
        setSuggestions(
          recents.map(r => ({
            kind: 'recent',
            label: r.locationLabel,
            subtitle: r.zip_code,
            lat: r.lat,
            lng: r.lng,
          }))
        )
        setShowDropdown(true)
      } else {
        setShowDropdown(false)
      }
      return
    }

    debounceRef.current = setTimeout(() => {
      fetchNominatimSuggestions(val.trim())
    }, 350)
  }

  function handleSelectSuggestion(suggestion) {
    setTextInput(suggestion.label)
    setLabel(suggestion.label)   // keeps handleFindStores from re-geocoding
    if (suggestion.lat != null && suggestion.lng != null) {
      setMarkerPos([suggestion.lat, suggestion.lng])
      setCenter([suggestion.lat, suggestion.lng])
    }
    setShowDropdown(false)
    setActiveIndex(-1)
    setSuggestions([])
  }

  function handleKeyDown(e) {
    if (!showDropdown || !suggestions.length) {
      if (e.key === 'Enter') handleFindStores()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0) {
        handleSelectSuggestion(suggestions[activeIndex])
      } else {
        handleFindStores()
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      setActiveIndex(-1)
    }
  }

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

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }
    setGeoLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        setMarkerPos([lat, lng])
        setCenter([lat, lng])
        const lbl = await reverseGeocode(lat, lng)
        setLabel(lbl)
        if (lbl) setTextInput(lbl)
        setShowDropdown(false)
        setActiveIndex(-1)
        setSuggestions([])
        setGeoLoading(false)
      },
      (err) => {
        const messages = {
          1: 'Location access denied. Type an address instead.',
          2: 'Could not get your location. Type an address instead.',
          3: 'Location request timed out. Type an address instead.',
        }
        setError(messages[err.code] || 'Could not get your location.')
        setGeoLoading(false)
      },
      { timeout: 10000 }
    )
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
            onMapClick={loading ? null : handleMapClick}
            lightTheme
            radiusMeters={markerPos ? radiusMeters : 0}
            className="w-full h-full"
            style={{ borderRadius: 0 }}
          />
          {loading && (
            <div className="absolute inset-0 z-[500]" style={{ cursor: 'not-allowed' }} />
          )}
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
          <div ref={containerRef} className="relative">
            <div
              className="flex items-center gap-[10px] rounded-[12px] border px-[14px] py-[13px] bg-white"
              style={{ borderColor: showDropdown ? '#4f51a8' : '#cbb2fe' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" stroke="#757bc8" strokeWidth="2" strokeLinejoin="round" />
                <circle cx="12" cy="10" r="2.4" stroke="#757bc8" strokeWidth="2" />
              </svg>
              <input
                role="combobox"
                aria-expanded={showDropdown && suggestions.length > 0}
                aria-autocomplete="list"
                aria-controls="location-suggestions"
                aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
                type="text"
                placeholder="Address, neighborhood, or ZIP"
                value={textInput}
                onChange={handleInputChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="flex-1 text-[14px] bg-transparent outline-none placeholder:text-[#aaa4cf]"
                style={{ color: '#2a2356' }}
              />
              <div style={{ width: 1, height: 18, background: '#e8e0ff', flexShrink: 0 }} />
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={geoLoading}
                aria-label="Use my current location"
                style={{
                  flexShrink: 0,
                  padding: '6px 8px',
                  background: 'none',
                  border: 'none',
                  cursor: geoLoading ? 'not-allowed' : 'pointer',
                  opacity: geoLoading ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {geoLoading ? (
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    className="animate-spin"
                  >
                    <circle
                      cx="12" cy="12" r="9"
                      stroke="#4f51a8" strokeWidth="2"
                      strokeDasharray="28 56" strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="3" stroke="#4f51a8" strokeWidth="2" />
                    <path
                      d="M12 2v3M12 19v3M2 12h3M19 12h3"
                      stroke="#4f51a8" strokeWidth="2" strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>
            </div>

            {/* Autocomplete dropdown */}
            {showDropdown && suggestions.length > 0 && (
              <div
                id="location-suggestions"
                role="listbox"
                className="absolute left-0 right-0 bg-white rounded-[12px] overflow-hidden z-50"
                style={{
                  top: 'calc(100% + 6px)',
                  border: '1px solid #cbb2fe',
                  boxShadow: '0 8px 24px rgba(79,81,168,0.12)',
                }}
              >
                {suggestions[0]?.kind === 'recent' && (
                  <div
                    className="px-[14px] pt-[8px] pb-[4px] text-[11px] font-semibold"
                    style={{ color: '#aaa4cf' }}
                  >
                    Recent
                  </div>
                )}

                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    id={`suggestion-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseDown={() => handleSelectSuggestion(s)}
                    className="flex items-start gap-[10px] px-[14px] py-[10px] cursor-pointer"
                    style={{
                      borderBottom: i < suggestions.length - 1 ? '1px solid #f0eaff' : 'none',
                      backgroundColor: i === activeIndex ? '#f5f0ff' : 'white',
                    }}
                  >
                    {s.kind === 'recent' ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ marginTop: 2, flexShrink: 0 }}>
                        <path d="M12 8v4l3 3" stroke="#aaa4cf" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="12" cy="12" r="9" stroke="#aaa4cf" strokeWidth="2" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ marginTop: 2, flexShrink: 0 }}>
                        <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" stroke="#aaa4cf" strokeWidth="2" strokeLinejoin="round" />
                      </svg>
                    )}
                    <div>
                      <div className="text-[13px] font-semibold" style={{ color: '#2a2356' }}>
                        {s.label}
                      </div>
                      {s.subtitle && (
                        <div className="text-[11px] mt-[1px]" style={{ color: '#8a86b8' }}>
                          {s.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {suggestions[0]?.kind === 'nominatim' && (
                  <div
                    className="px-[12px] py-[6px] text-[10px] text-right"
                    style={{ color: '#aaa4cf', backgroundColor: '#faf8ff', borderTop: '1px solid #f0eaff' }}
                  >
                    Powered by OpenStreetMap
                  </div>
                )}
              </div>
            )}
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
