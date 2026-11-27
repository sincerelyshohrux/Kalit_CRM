import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'

export const TASHKENT: [number, number] = [41.3111, 69.2797]

/**
 * Xarita plitkalari. Standart — OpenStreetMap (CSS filtr bilan qorong'i qilinadi).
 * Prod'da yuqori trafik uchun o'z provayderingizni VITE_MAP_TILES orqali bering
 * (OSM foydalanish siyosati katta trafikni taqiqlaydi).
 */
export const TILES = import.meta.env.VITE_MAP_TILES || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const DARKEN = !import.meta.env.VITE_MAP_TILES

// Bundler bilan standart marker rasmlari buziladi — o'zimizning CSS pin ishlatamiz
export const pin = L.divIcon({
  className: 'map-pin',
  html: '<span class="map-pin__dot"></span><span class="map-pin__pulse"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

export interface LatLng {
  lat: number
  lng: number
}

function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

function FlyTo({ point }: { point: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (point) map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 15), { duration: 0.8 })
  }, [point?.lat, point?.lng]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export function MapPicker({ value, onChange, readOnly, height = 420 }: { value: LatLng | null; onChange?: (p: LatLng) => void; readOnly?: boolean; height?: number }) {
  return (
    <div className="map-wrap" style={{ height }}>
      <MapContainer center={value ? [value.lat, value.lng] : TASHKENT} zoom={value ? 15 : 12} scrollWheelZoom className={DARKEN ? 'map map--darken' : 'map'} attributionControl>
        <TileLayer
          url={TILES}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
          maxZoom={19}
        />
        {!readOnly && onChange && <ClickHandler onPick={onChange} />}
        <FlyTo point={value} />
        {value && (
          <Marker
            position={[value.lat, value.lng]}
            icon={pin}
            draggable={!readOnly}
            eventHandlers={{
              dragend: (e) => {
                const ll = (e.target as L.Marker).getLatLng()
                onChange?.({ lat: ll.lat, lng: ll.lng })
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  )
}

/** "41.31, 69.24", Google/Yandex xarita havolalari -> koordinata (faqat matndan, tarmoqqa so'rovsiz) */
export function parseCoords(text: string): LatLng | null {
  const t = text.trim()
  const patterns = [
    /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, // google.com/maps/@41.3,69.2,15z
    /[?&](?:q|ll|query)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i,
    /[?&]pt=(-?\d{1,3}\.\d+),(-?\d{1,2}\.\d+)/, // yandex: pt=lng,lat
    /^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/,
  ]
  for (const [i, re] of patterns.entries()) {
    const m = t.match(re)
    if (!m) continue
    let lat = parseFloat(m[1])
    let lng = parseFloat(m[2])
    if (i === 2) [lat, lng] = [lng, lat]
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
  }
  return null
}
