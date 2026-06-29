import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const makePin = (color, label = '') => L.divIcon({
  className: '',
  html: `<div style="position:relative;width:36px;height:36px">
    ${label ? `<div style="position:absolute;bottom:calc(100% + 3px);left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(255,255,255,0.96);color:#2a2356;font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.18);font-family:system-ui,sans-serif;pointer-events:none;line-height:1.4">${label}</div>` : ''}
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3" fill="white" stroke="none"/>
    </svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
})

const userPin = makePin('#4f51a8')
const storeDot = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
    <circle cx="9" cy="9" r="7" fill="#cbb2fe" stroke="white" stroke-width="2"/>
  </svg>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function ClickHandler({ onMapClick }) {
  useMapEvents({ click: e => onMapClick && onMapClick(e.latlng) })
  return null
}

function RecenterMap({ center }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, map.getZoom(), { duration: 0.5 })
  }, [center[0], center[1]])
  return null
}

function storeLabel(name) {
  return name?.replace(/\s+#\d+.*$/, '').replace(/\s+-\s+.*$/, '').trim() || ''
}

export default function Map({
  center = [40.7128, -74.006],
  markerPos,
  onMapClick,
  stores = [],
  selectedSlugs,
  onStoreClick,
  showLabels = false,
  lightTheme = false,
  radiusMeters,
  className = 'w-full h-64 rounded-xl',
  style,
}) {
  const tileUrl = lightTheme
    ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

  return (
    <MapContainer center={center} zoom={13} className={className} style={{ zIndex: 0, ...style }}>
      <TileLayer url={tileUrl} attribution='&copy; <a href="https://carto.com/">CARTO</a>' />
      <RecenterMap center={center} />
      <ClickHandler onMapClick={onMapClick} />
      {markerPos && <Marker position={markerPos} icon={userPin} />}
      {markerPos && radiusMeters > 0 && (
        <Circle
          center={markerPos}
          radius={radiusMeters}
          pathOptions={{ color: '#4f51a8', fillColor: '#9fa0ff', fillOpacity: 0.18, weight: 1.5, opacity: 0.5 }}
        />
      )}
      {stores.map(s => {
        if (!s.lat || !s.lng) return null
        const active = !selectedSlugs || selectedSlugs.has(s.slug)
        const icon = active
          ? makePin('#757bc8', showLabels ? storeLabel(s.store_name) : '')
          : storeDot
        return (
          <Marker
            key={s.slug}
            position={[s.lat, s.lng]}
            icon={icon}
            eventHandlers={onStoreClick ? { click: () => onStoreClick(s.slug) } : undefined}
          />
        )
      })}
    </MapContainer>
  )
}
