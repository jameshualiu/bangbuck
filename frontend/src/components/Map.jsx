import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Fix Leaflet's broken default marker icons when bundled with Vite/webpack
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
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
      {markerPos && <Marker position={markerPos} />}
      {markerPos && radiusMeters > 0 && (
        <Circle
          center={markerPos}
          radius={radiusMeters}
          pathOptions={{ color: '#4f51a8', fillColor: '#9fa0ff', fillOpacity: 0.18, weight: 1.5, opacity: 0.5 }}
        />
      )}
      {stores.map(s =>
        s.lat && s.lng ? <Marker key={s.slug} position={[s.lat, s.lng]} /> : null
      )}
    </MapContainer>
  )
}
