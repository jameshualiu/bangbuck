import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const makePin = (color) => L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
    <circle cx="12" cy="10" r="3" fill="white" stroke="none"/>
  </svg>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
})

const userPin = makePin('#4f51a8')
const storeActivePin = makePin('#757bc8')
const storeDot = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">
    <circle cx="5" cy="5" r="5" fill="#cbb2fe"/>
  </svg>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
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

export default function Map({
  center = [40.7128, -74.006],
  markerPos,
  onMapClick,
  stores = [],
  selectedSlugs,
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
        return <Marker key={s.slug} position={[s.lat, s.lng]} icon={active ? storeActivePin : storeDot} />
      })}
    </MapContainer>
  )
}
