import React, { useEffect, useRef, useState, useCallback } from "react"
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import L from 'leaflet'
import 'leaflet.markercluster'

// Fix Leaflet default icon paths broken by bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow })

import { useListCategories, useListLocations } from "@workspace/api-client-react"
import { Filter, X, MapPin, Loader2, SlidersHorizontal } from "lucide-react"

type MapMarker = {
  id: number
  title: string
  referenceNumber: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: string
  latitude: number
  longitude: number
  categoryName: string | null
  categoryColour: string | null
  namedLocationName: string | null
  safetyIssue: boolean
}

type Filters = {
  status: string
  priority: string
  categoryId: string
  namedLocationId: string
  safetyIssue: boolean
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#dc2626',
  high: '#ea580c',
  normal: '#1e6091',
  low: '#6b7280',
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'action_required', label: 'Action Required' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
]

function getPriorityBadgeHtml(priority: string): string {
  const color = PRIORITY_COLORS[priority] || '#6b7280'
  const label = PRIORITY_LABELS[priority] || priority
  return `<span style="display:inline-block;padding:2px 8px;background:${color}20;color:${color};border-radius:9999px;font-size:11px;font-weight:600;border:1px solid ${color}40">${label}</span>`
}

function buildQueryString(filters: Filters): string {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.priority) params.set('priority', filters.priority)
  if (filters.categoryId) params.set('categoryId', filters.categoryId)
  if (filters.namedLocationId) params.set('namedLocationId', filters.namedLocationId)
  if (filters.safetyIssue) params.set('safetyIssue', 'true')
  return params.toString()
}

function hasActiveFilters(f: Filters): boolean {
  return !!(f.status || f.priority || f.categoryId || f.namedLocationId || f.safetyIssue)
}

const DEFAULT_FILTERS: Filters = {
  status: '',
  priority: '',
  categoryId: '',
  namedLocationId: '',
  safetyIssue: false,
}

interface FilterPanelProps {
  filters: Filters
  onChange: (f: Filters) => void
  onClear: () => void
  categories: Array<{ id: number; name: string }>
  locations: Array<{ id: number; name: string }>
  markerCount: number
}

function FilterPanel({ filters, onChange, onClear, categories, locations, markerCount }: FilterPanelProps) {
  const active = hasActiveFilters(filters)
  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Filters</span>
        </div>
        {active && (
          <button
            onClick={onClear}
            className="text-xs text-destructive hover:underline flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5" />
        <span><strong>{markerCount}</strong> observation{markerCount !== 1 ? 's' : ''} on map</span>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
        <select
          value={filters.status}
          onChange={e => onChange({ ...filters, status: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Priority</label>
        <select
          value={filters.priority}
          onChange={e => onChange({ ...filters, priority: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</label>
        <select
          value={filters.categoryId}
          onChange={e => onChange({ ...filters, categoryId: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</label>
        <select
          value={filters.namedLocationId}
          onChange={e => onChange({ ...filters, namedLocationId: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All locations</option>
          {locations.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between py-2 border rounded-md px-3">
        <label className="text-sm font-medium cursor-pointer" htmlFor="safety-toggle">Safety issues only</label>
        <button
          id="safety-toggle"
          role="switch"
          aria-checked={filters.safetyIssue}
          onClick={() => onChange({ ...filters, safetyIssue: !filters.safetyIssue })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
            filters.safetyIssue ? 'bg-destructive' : 'bg-muted-foreground/30'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              filters.safetyIssue ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Priority legend */}
      <div className="border-t pt-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Priority legend</p>
        {Object.entries(PRIORITY_COLORS).map(([p, color]) => (
          <div key={p} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block w-3 h-3 rounded-full border border-white/50 shadow-sm flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="capitalize text-muted-foreground">{p}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null)
  const userMarkerRef = useRef<L.CircleMarker | null>(null)

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [markers, setMarkers] = useState<MapMarker[]>([])
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { data: categories = [] } = useListCategories()
  const { data: locations = [] } = useListLocations()

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [52.826, 1.284],
      zoom: 14,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    const clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      showCoverageOnHover: false,
    }) as L.MarkerClusterGroup
    map.addLayer(clusterGroup)

    mapRef.current = map
    clusterGroupRef.current = clusterGroup

    // Try to show user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          if (userMarkerRef.current) {
            userMarkerRef.current.remove()
          }
          const dot = L.circleMarker([latitude, longitude], {
            radius: 8,
            fillColor: '#3b82f6',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
          })
            .bindTooltip('Your location', { direction: 'top' })
            .addTo(map)
          userMarkerRef.current = dot
        },
        () => {
          // Permission denied or unavailable — silently ignore
        }
      )
    }

    return () => {
      map.remove()
      mapRef.current = null
      clusterGroupRef.current = null
    }
  }, [])

  // Fetch markers when filters change
  const fetchMarkers = useCallback(async () => {
    setLoading(true)
    try {
      const qs = buildQueryString(filters)
      const res = await fetch('/api/observations/map' + (qs ? '?' + qs : ''))
      if (!res.ok) throw new Error('Failed to fetch map markers')
      const data: MapMarker[] = await res.json()
      setMarkers(data)
    } catch (err) {
      console.error('Map fetch error:', err)
      setMarkers([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchMarkers()
  }, [fetchMarkers])

  // Rebuild markers on map when markers data changes
  useEffect(() => {
    const group = clusterGroupRef.current
    if (!group) return

    group.clearLayers()

    markers.forEach((m) => {
      const color = PRIORITY_COLORS[m.priority] || '#6b7280'
      const circle = L.circleMarker([m.latitude, m.longitude], {
        radius: 8,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
      })

      const popupHtml = `
        <div style="min-width:200px;padding:4px">
          <div style="font-weight:600;margin-bottom:4px;font-size:14px">${escapeHtml(m.title)}</div>
          <div style="font-size:12px;color:#666;margin-bottom:8px">${escapeHtml(m.referenceNumber)} · ${escapeHtml(m.status.replace('_', ' '))}</div>
          <div style="margin-bottom:8px">${getPriorityBadgeHtml(m.priority)}${m.safetyIssue ? ' <span style="font-size:13px">⚠️ Safety</span>' : ''}</div>
          ${m.namedLocationName ? `<div style="font-size:12px;color:#666;margin-bottom:8px">📍 ${escapeHtml(m.namedLocationName)}</div>` : ''}
          <a href="/observations/${m.id}" style="display:inline-block;padding:4px 12px;background:#1e4a2e;color:white;border-radius:6px;font-size:13px;text-decoration:none">View observation</a>
        </div>
      `

      circle.bindPopup(L.popup({ maxWidth: 300 }).setContent(popupHtml))
      group.addLayer(circle)
    })
  }, [markers])

  const handleClearFilters = () => setFilters(DEFAULT_FILTERS)
  const active = hasActiveFilters(filters)

  const filterPanel = (
    <FilterPanel
      filters={filters}
      onChange={setFilters}
      onClear={handleClearFilters}
      categories={categories}
      locations={locations}
      markerCount={markers.length}
    />
  )

  return (
    <div className="flex h-full w-full" style={{ height: 'calc(100dvh - 60px)' }}>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[280px] flex-shrink-0 border-r bg-background">
        {filterPanel}
      </aside>

      {/* Map area */}
      <div className="relative flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-background border-b z-10 flex-shrink-0">
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <MapPin className="h-4 w-4 text-primary" />
            )}
            <span className="text-sm font-medium">
              {loading ? 'Loading…' : `${markers.length} observation${markers.length !== 1 ? 's' : ''}`}
            </span>
            {active && !loading && (
              <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
                Filtered
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {active && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 hidden md:flex"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
            {/* Mobile filter button */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-background text-sm font-medium shadow-sm hover:bg-muted/50"
            >
              <Filter className="h-4 w-4" />
              Filters
              {active && <span className="w-2 h-2 rounded-full bg-primary inline-block" />}
            </button>
          </div>
        </div>

        {/* Map container */}
        <div className="relative flex-1">
          <div ref={mapContainerRef} className="absolute inset-0" />

          {/* Empty state overlay */}
          {!loading && markers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="bg-background/90 backdrop-blur-sm rounded-xl border shadow-lg px-6 py-5 text-center max-w-xs pointer-events-auto">
                <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">No observations with coordinates found</p>
                {active && (
                  <button
                    onClick={handleClearFilters}
                    className="mt-3 text-xs text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer */}
          <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-xl max-h-[80dvh] flex flex-col">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b">
              <span className="font-semibold">Filter Map</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded-md hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filterPanel}
            </div>
            <div className="p-4 border-t">
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
