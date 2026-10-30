import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix standard Leaflet asset pathing in bundled environments
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const DEFAULT_CENTER = [20.5937, 78.9629] // Default coordinates (India)

function createIncidentIcon(severity = 'moderate') {
  const sev = severity.toLowerCase()
  const colorClass = sev.includes('critical')
    ? 'pulse-critical'
    : sev.includes('high') || sev.includes('severe')
    ? 'pulse-high'
    : sev.includes('moderate')
    ? 'pulse-moderate'
    : 'pulse-low'

  return L.divIcon({
    className: 'custom-map-icon',
    html: `<div class="map-pulse-marker ${colorClass}"><span class="pulse-ring"></span><span class="marker-core">⚠</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

function createRequestIcon(priority = 'P4') {
  const prio = (priority || 'P4').toUpperCase()
  const colorClass = prio === 'P1'
    ? 'req-p1'
    : prio === 'P2'
    ? 'req-p2'
    : prio === 'P3'
    ? 'req-p3'
    : 'req-p4'

  return L.divIcon({
    className: 'custom-map-icon',
    html: `<div class="map-request-marker ${colorClass}"><span class="prio-tag">${prio}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  })
}

export default function ResponseMap({ disasters = [], requests = [], onSelectIncident, onSelectRequest }) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const layerGroupRef = useRef(null)
  const [filter, setFilter] = useState('ALL') // 'ALL', 'P1', 'DISASTERS', 'NEARBY'
  const [userLocation, setUserLocation] = useState(null)

  // Initialize Leaflet Map instance
  useEffect(() => {
    if (!mapContainerRef.current) return

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: DEFAULT_CENTER,
        zoom: 12,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      layerGroupRef.current = L.layerGroup().addTo(map)
      mapInstanceRef.current = map
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Update markers and circles whenever disasters, requests, or filter changes
  useEffect(() => {
    const map = mapInstanceRef.current
    const layerGroup = layerGroupRef.current
    if (!map || !layerGroup) return

    layerGroup.clearLayers()
    const bounds = []

    // 1. Plot Disasters
    if (filter !== 'P1') {
      disasters.forEach((item) => {
        const lat = Number(item.latitude) || DEFAULT_CENTER[0]
        const lng = Number(item.longitude) || DEFAULT_CENTER[1]
        bounds.push([lat, lng])

        // Danger perimeter circle (3 km)
        const radius = item.severity?.toLowerCase().includes('critical') ? 4000 : 2500
        const circle = L.circle([lat, lng], {
          color: item.severity?.toLowerCase().includes('critical') ? '#e53e3e' : '#dd6b20',
          fillColor: item.severity?.toLowerCase().includes('critical') ? '#feb2b2' : '#fbd38d',
          fillOpacity: 0.18,
          weight: 2,
          dashArray: '4, 6',
        })
        layerGroup.addLayer(circle)

        // Marker
        const marker = L.marker([lat, lng], { icon: createIncidentIcon(item.severity) })
        marker.bindPopup(`
          <div class="map-popup-card">
            <div class="popup-badge badge-${(item.severity || 'moderate').toLowerCase()}">${item.severity || 'Incident'}</div>
            <h4>${item.title || item.type || 'Disaster Report'}</h4>
            <p class="popup-loc">📍 ${item.location || 'Unknown location'}</p>
            <p class="popup-desc">${item.description || 'No additional details provided.'}</p>
            <small class="popup-time">Reported: ${new Date(item.reportedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
          </div>
        `)
        layerGroup.addLayer(marker)
      })
    }

    // 2. Plot Requests
    requests.forEach((req, idx) => {
      if (filter === 'DISASTERS') return
      if (filter === 'P1' && req.priority !== 'P1') return

      // Use the request's geocoded coordinates; retain an offset fallback for older requests.
      let lat = DEFAULT_CENTER[0] + (Math.sin(idx * 1.5) * 0.035)
      let lng = DEFAULT_CENTER[1] + (Math.cos(idx * 1.5) * 0.035)

      if (Number.isFinite(Number(req.latitude)) && Number.isFinite(Number(req.longitude))) {
        lat = Number(req.latitude)
        lng = Number(req.longitude)
      } else if (disasters[0]?.latitude && disasters[0]?.longitude) {
        lat = Number(disasters[0].latitude) + (Math.sin(idx * 1.3) * 0.025)
        lng = Number(disasters[0].longitude) + (Math.cos(idx * 1.3) * 0.025)
      }

      bounds.push([lat, lng])

      const marker = L.marker([lat, lng], { icon: createRequestIcon(req.priority) })
      marker.bindPopup(`
        <div class="map-popup-card request-popup">
          <div class="popup-badge badge-prio">${req.priority || 'P4'} Priority</div>
          <h4>${req.name || 'Emergency Requester'}</h4>
          <p class="popup-loc">📍 ${req.location || 'Location pending'}</p>
          <p class="popup-desc"><strong>Need:</strong> ${req.details || 'Assistance requested'}</p>
          ${req.needTags ? `<div class="popup-tags">${req.needTags.split(',').map(t => `<span class="mini-tag">${t.trim()}</span>`).join('')}</div>` : ''}
          <div class="popup-action-row">
            ${req.phone ? `<a class="popup-btn popup-btn-call" href="tel:${req.phone}">📞 Call ${req.phone}</a>` : ''}
            <span class="popup-status status-${(req.status || 'open').toLowerCase()}">${req.status || 'OPEN'}</span>
          </div>
        </div>
      `)
      layerGroup.addLayer(marker)
    })

    // Fit map to visible pins
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
    }
  }, [disasters, requests, filter])

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setUserLocation([latitude, longitude])
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 14)
          L.circleMarker([latitude, longitude], {
            radius: 8,
            color: '#3182ce',
            fillColor: '#63b3ed',
            fillOpacity: 0.9,
          }).bindPopup('📍 Your current location').addTo(mapInstanceRef.current)
        }
      },
      (err) => alert('Unable to retrieve location: ' + err.message)
    )
  }

  return (
    <div className="map-view-shell">
      <div className="map-controls-bar">
        <div className="map-title-wrap">
          <h3>Live Disaster & Response Map</h3>
          <span className="live-indicator"><span className="pulse-dot"></span> Real-time spatial tracking</span>
        </div>

        <div className="map-filter-group">
          <button
            className={`map-filter-btn ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilter('ALL')}
          >
            All Pins ({disasters.length + requests.length})
          </button>
          <button
            className={`map-filter-btn ${filter === 'P1' ? 'active' : ''}`}
            onClick={() => setFilter('P1')}
          >
            🚨 P1 Critical Only ({requests.filter(r => r.priority === 'P1').length})
          </button>
          <button
            className={`map-filter-btn ${filter === 'DISASTERS' ? 'active' : ''}`}
            onClick={() => setFilter('DISASTERS')}
          >
            🔥 Incidents Only ({disasters.length})
          </button>
        </div>

        <div className="map-action-buttons">
          <button className="button button-secondary button-small" onClick={handleLocateMe}>
            📍 Center on Me
          </button>
        </div>
      </div>

      <div className="map-container-wrapper">
        <div ref={mapContainerRef} className="leaflet-map-element" style={{ width: '100%', height: '560px', borderRadius: '12px' }} />
        
        {/* Map Legend Overlay */}
        <div className="map-legend-overlay">
          <strong>Map Key</strong>
          <div className="legend-item"><span className="legend-pin red">⚠</span> Critical Incident (Perimeter active)</div>
          <div className="legend-item"><span className="legend-pin orange">⚠</span> High / Moderate Incident</div>
          <div className="legend-item"><span className="legend-box p1">P1</span> Life-Threatening Rescue</div>
          <div className="legend-item"><span className="legend-box p2">P2</span> Urgent Medical / Vulnerable</div>
          <div className="legend-item"><span className="legend-box p3">P3</span> Supplies / Food / Water</div>
        </div>
      </div>
    </div>
  )
}
