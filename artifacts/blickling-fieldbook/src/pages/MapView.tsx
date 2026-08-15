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

import { useLocation } from "wouter"
import { useListCategories, useListLocations } from "@workspace/api-client-react"
import { Crosshair, X, MapPin, SlidersHorizontal } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { getOfflineAccount } from "@/lib/offlineFallback"
import { readOfflineCollection } from "@/lib/offlineStore"

const C = {
  bg: "#0d1117",
  surface: "#161b22",
  border: "#30363d",
  borderMid: "#21262d",
  text: "#e6edf3",
  muted: "#8b949e",
  dim: "#7d8590",
  emerald: "#10b981", emeraldBtn: "#047857",
  emeraldDark: "#0d9268",
}

const HEAD = { fontFamily: "'Space Grotesk', sans-serif" }
const BODY = { fontFamily: "'Inter', sans-serif" }

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

type TaskMarker = {
  id: number
  title: string
  referenceNumber: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: string
  latitude: number
  longitude: number
  namedLocationName: string | null
  observationId: number | null
  dueDate: string | null
}

type Filters = {
  status: string
  priority: string
  categoryId: string
  namedLocationId: string
  safetyIssue: boolean
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#f85149',
  high: '#d29922',
  normal: '#58a6ff',
  low: '#8b949e',
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

const selectStyle: React.CSSProperties = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  color: C.text,
  borderRadius: "0.5rem",
  padding: "0.4rem 0.75rem",
  fontSize: 13,
  width: "100%",
  outline: "none",
  ...BODY,
}

interface FilterPanelProps {
  filters: Filters
  onChange: (f: Filters) => void
  onClear: () => void
  categories: Array<{ id: number; name: string }>
  locations: Array<{ id: number; name: string }>
  markerCount: number
  taskCount: number
  showObservations: boolean
  showTasks: boolean
  onToggleObservations: () => void
  onToggleTasks: () => void
}

function LayerToggle({ id, label, checked, onToggle }: { id: string; label: string; checked: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md" style={{ border: `1px solid ${C.border}` }}>
      <label className="text-sm cursor-pointer" style={{ ...BODY, fontSize: 13, color: C.text }} htmlFor={id}>{label}</label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
        style={{ background: checked ? C.emerald : C.dim }}
      >
        <span
          className="inline-block h-4 w-4 transform rounded-full shadow transition-transform"
          style={{ background: "#fff", transform: checked ? "translateX(16px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  )
}

function FilterPanel({ filters, onChange, onClear, categories, locations, markerCount, taskCount, showObservations, showTasks, onToggleObservations, onToggleTasks }: FilterPanelProps) {
  const active = hasActiveFilters(filters)
  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto" style={{ background: C.surface }}>
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" style={{ color: C.muted }} />
          <span style={{ ...HEAD, fontWeight: 600, fontSize: 13, color: C.text }}>Filters</span>
        </div>
        {active && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-xs"
            style={{ color: C.muted, background: "none", border: "none", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = C.text}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = C.muted}
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Marker count badge */}
      <div
        className="flex items-center gap-1.5 px-3 py-2 rounded-md"
        style={{ background: C.borderMid, border: `1px solid ${C.border}` }}
      >
        <MapPin className="h-3.5 w-3.5" style={{ color: C.emerald }} />
        <span style={{ ...BODY, fontSize: 12, color: C.muted }}>
          <strong style={{ color: C.text }}>{markerCount}</strong> observation{markerCount !== 1 ? 's' : ''} · <strong style={{ color: C.text }}>{taskCount}</strong> task{taskCount !== 1 ? 's' : ''} on map
        </span>
      </div>

      {/* Layers */}
      <div className="space-y-2">
        <p style={{ ...HEAD, fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Layers
        </p>
        <LayerToggle id="layer-observations" label="Observations" checked={showObservations} onToggle={onToggleObservations} />
        <LayerToggle id="layer-tasks" label="Open tasks" checked={showTasks} onToggle={onToggleTasks} />
        <p style={{ ...BODY, fontSize: 11, color: C.dim }}>
          Priority and location filters apply to both layers. Status, category and safety filters apply to observations only.
        </p>
      </div>

      {/* Status */}
      <div className="space-y-1">
        <label style={{ ...HEAD, fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Status <span style={{ textTransform: "none", fontWeight: 400 }}>(observations)</span>
        </label>
        <select
          value={filters.status}
          onChange={e => onChange({ ...filters, status: e.target.value })}
          style={selectStyle}
          onFocus={e => (e.target as HTMLSelectElement).style.borderColor = C.emerald}
          onBlur={e => (e.target as HTMLSelectElement).style.borderColor = C.border}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Priority */}
      <div className="space-y-1">
        <label style={{ ...HEAD, fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Priority
        </label>
        <select
          value={filters.priority}
          onChange={e => onChange({ ...filters, priority: e.target.value })}
          style={selectStyle}
          onFocus={e => (e.target as HTMLSelectElement).style.borderColor = C.emerald}
          onBlur={e => (e.target as HTMLSelectElement).style.borderColor = C.border}
        >
          {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Category */}
      <div className="space-y-1">
        <label style={{ ...HEAD, fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Category
        </label>
        <select
          value={filters.categoryId}
          onChange={e => onChange({ ...filters, categoryId: e.target.value })}
          style={selectStyle}
          onFocus={e => (e.target as HTMLSelectElement).style.borderColor = C.emerald}
          onBlur={e => (e.target as HTMLSelectElement).style.borderColor = C.border}
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
      </div>

      {/* Location */}
      <div className="space-y-1">
        <label style={{ ...HEAD, fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Location
        </label>
        <select
          value={filters.namedLocationId}
          onChange={e => onChange({ ...filters, namedLocationId: e.target.value })}
          style={selectStyle}
          onFocus={e => (e.target as HTMLSelectElement).style.borderColor = C.emerald}
          onBlur={e => (e.target as HTMLSelectElement).style.borderColor = C.border}
        >
          <option value="">All locations</option>
          {locations.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
        </select>
      </div>

      {/* Safety toggle */}
      <div
        className="flex items-center justify-between py-2 px-3 rounded-md"
        style={{ border: `1px solid ${C.border}` }}
      >
        <label
          className="text-sm cursor-pointer"
          style={{ ...BODY, fontSize: 13, color: C.text }}
          htmlFor="safety-toggle"
        >
          Safety issues only
        </label>
        <button
          id="safety-toggle"
          role="switch"
          aria-checked={filters.safetyIssue}
          onClick={() => onChange({ ...filters, safetyIssue: !filters.safetyIssue })}
          className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
          style={{ background: filters.safetyIssue ? "#f85149" : C.dim }}
        >
          <span
            className="inline-block h-4 w-4 transform rounded-full shadow transition-transform"
            style={{
              background: "#fff",
              transform: filters.safetyIssue ? "translateX(16px)" : "translateX(2px)",
            }}
          />
        </button>
      </div>

      {/* Priority legend */}
      <div className="pt-3 space-y-2" style={{ borderTop: `1px solid ${C.borderMid}` }}>
        <p style={{ ...HEAD, fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Priority legend
        </p>
        {Object.entries(PRIORITY_COLORS).map(([p, color]) => (
          <div key={p} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: color, border: "1px solid rgba(255,255,255,0.15)" }}
            />
            <span className="capitalize" style={{ ...BODY, fontSize: 12, color: C.muted }}>{p}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <span
            className="inline-block w-3 h-3 flex-shrink-0"
            style={{ backgroundColor: C.dim, border: "1px solid rgba(255,255,255,0.3)", borderRadius: 9999 }}
          />
          <span style={{ ...BODY, fontSize: 12, color: C.muted }}>Circle = observation</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 flex-shrink-0"
            style={{ backgroundColor: C.dim, border: "1px solid rgba(255,255,255,0.3)", transform: "rotate(45deg)" }}
          />
          <span style={{ ...BODY, fontSize: 12, color: C.muted }}>Diamond = open task</span>
        </div>
        <p style={{ ...BODY, fontSize: 11, color: C.dim }}>Tap a marker to open its details.</p>
      </div>
    </div>
  )
}

export default function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null)
  const userMarkerRef = useRef<L.CircleMarker | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  const [, navigate] = useLocation()
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [markers, setMarkers] = useState<MapMarker[]>([])
  const [taskMarkers, setTaskMarkers] = useState<TaskMarker[]>([])
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [obsError, setObsError] = useState<string | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [obsUpdatedAt, setObsUpdatedAt] = useState<Date | null>(null)
  const [taskUpdatedAt, setTaskUpdatedAt] = useState<Date | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [totalMarkers, setTotalMarkers] = useState(0)
  const [taskTruncated, setTaskTruncated] = useState(false)
  const [totalTaskMarkers, setTotalTaskMarkers] = useState(0)
  const [showObservations, setShowObservations] = useState(true)
  const [showTasks, setShowTasks] = useState(true)
  // Offline fallback: map tiles cannot be bulk-downloaded in advance under
  // the OpenStreetMap tile policy, so offline we show cached records as a list.
  const [offlineRows, setOfflineRows] = useState<Array<{ kind: "observation" | "task"; id: number; referenceNumber: string; title: string; priority: string; locationName: string | null }> | null>(null)

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

    return () => {
      map.remove()
      mapRef.current = null
      clusterGroupRef.current = null
    }
  }, [])

  const fetchMarkers = useCallback(async () => {
    requestRef.current?.abort()
    const controller = new AbortController(); requestRef.current = controller
    setLoading(true)
    // Each layer is fetched independently so one failed request does not
    // erase the other layer; the failed layer keeps its last data + data age.
    const loadObservations = async () => {
      try {
        const qs = buildQueryString(filters)
        const res = await apiFetch('/api/observations/map' + (qs ? '?' + qs : ''), { signal: controller.signal })
        if (!res.ok) throw new Error((await res.json().catch(() => null) as { error?: string } | null)?.error ?? 'Map observations could not be loaded.')
        const data: MapMarker[] = await res.json()
        setMarkers(data)
        setTotalMarkers(Number(res.headers.get("X-Total-Count") ?? data.length))
        setTruncated(res.headers.get("X-Result-Truncated") === "true")
        setObsError(null)
        setObsUpdatedAt(new Date())
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setObsError(err instanceof Error ? err.message : "Map observations could not be loaded.")
      }
    }
    const loadTasks = async () => {
      try {
        const taskParams = new URLSearchParams()
        if (filters.priority) taskParams.set('priority', filters.priority)
        if (filters.namedLocationId) taskParams.set('namedLocationId', filters.namedLocationId)
        const taskQs = taskParams.toString()
        const taskRes = await apiFetch('/api/actions/map' + (taskQs ? '?' + taskQs : ''), { signal: controller.signal })
        if (!taskRes.ok) throw new Error((await taskRes.json().catch(() => null) as { error?: string } | null)?.error ?? 'Map tasks could not be loaded.')
        const taskData: TaskMarker[] = await taskRes.json()
        setTaskMarkers(taskData)
        setTotalTaskMarkers(Number(taskRes.headers.get("X-Total-Count") ?? taskData.length))
        setTaskTruncated(taskRes.headers.get("X-Result-Truncated") === "true")
        setTaskError(null)
        setTaskUpdatedAt(new Date())
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setTaskError(err instanceof Error ? err.message : "Map tasks could not be loaded.")
      }
    }
    await Promise.all([loadObservations(), loadTasks()])
    if (requestRef.current === controller) setLoading(false)
  }, [filters])

  // When offline, build a cached-records list from the structured offline
  // store so field staff can still find records without the map.
  useEffect(() => {
    if (navigator.onLine) { setOfflineRows(null); return }
    const account = getOfflineAccount()
    if (!account) return
    let cancelled = false
    const load = async () => {
      const [observations, actions, locations] = await Promise.all([
        readOfflineCollection<Record<string, unknown>>(account.userId, account.propertyId, "observations"),
        readOfflineCollection<Record<string, unknown>>(account.userId, account.propertyId, "actions"),
        readOfflineCollection<Record<string, unknown>>(account.userId, account.propertyId, "locations"),
      ])
      if (cancelled) return
      const locationName = new Map(locations.map((l) => [l.id as number, l.name as string]))
      const rows = [
        ...observations.filter((o) => o.status !== "closed").map((o) => ({
          kind: "observation" as const, id: o.id as number, referenceNumber: String(o.referenceNumber ?? ""),
          title: String(o.title ?? ""), priority: String(o.priority ?? "normal"),
          locationName: o.namedLocationId != null ? locationName.get(o.namedLocationId as number) ?? null : null,
        })),
        ...actions.filter((a) => a.status !== "completed" && a.status !== "cancelled").map((a) => ({
          kind: "task" as const, id: a.id as number, referenceNumber: String(a.referenceNumber ?? ""),
          title: String(a.title ?? ""), priority: String(a.priority ?? "normal"),
          locationName: a.namedLocationId != null ? locationName.get(a.namedLocationId as number) ?? null : null,
        })),
      ]
      setOfflineRows(rows)
    }
    load().catch(() => setOfflineRows([]))
    const onOnline = () => setOfflineRows(null)
    window.addEventListener("online", onOnline)
    return () => { cancelled = true; window.removeEventListener("online", onOnline) }
  }, [])

  const locateMe = () => {
    if (!navigator.geolocation || !mapRef.current) return setError("Location is unavailable on this device.")
    setError(null)
    navigator.geolocation.getCurrentPosition((position) => {
      const point: L.LatLngExpression = [position.coords.latitude, position.coords.longitude]
      userMarkerRef.current?.remove()
      userMarkerRef.current = L.circleMarker(point, { radius: 8, fillColor: '#3b82f6', color: '#fff', weight: 2, fillOpacity: 0.9 })
        .bindTooltip('Your location', { direction: 'top' }).addTo(mapRef.current!)
      mapRef.current?.setView(point, Math.max(mapRef.current.getZoom(), 16))
    }, () => setError("Your location could not be obtained. Check this site’s location permission."), { enableHighAccuracy: true, timeout: 10000 })
  }

  useEffect(() => {
    fetchMarkers()
  }, [fetchMarkers])

  useEffect(() => {
    const group = clusterGroupRef.current
    if (!group) return
    group.clearLayers()
    if (showObservations) markers.forEach((m) => {
      const color = PRIORITY_COLORS[m.priority] || '#8b949e'
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;background:${color};border:2px solid #fff;border-radius:9999px;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
      const marker = L.marker([m.latitude, m.longitude], { icon, keyboard: true, title: `Observation ${m.referenceNumber}: ${m.title}` })
      marker.bindTooltip(`${escapeHtml(m.referenceNumber)} · ${escapeHtml(m.title)}`, { direction: 'top' })
      marker.on('click', () => navigate(`/observations/${m.id}`))
      group.addLayer(marker)
    })
    if (showTasks) taskMarkers.forEach((t) => {
      const color = PRIORITY_COLORS[t.priority] || '#8b949e'
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;background:${color};border:2px solid #fff;transform:rotate(45deg);box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })
      const marker = L.marker([t.latitude, t.longitude], { icon, keyboard: true, title: `Task ${t.referenceNumber}: ${t.title}` })
      marker.bindTooltip(`${escapeHtml(t.referenceNumber)} · ${escapeHtml(t.title)}`, { direction: 'top' })
      marker.on('click', () => navigate(`/actions/${t.id}`))
      group.addLayer(marker)
    })
  }, [markers, taskMarkers, navigate, showObservations, showTasks])

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
      taskCount={taskMarkers.length}
      showObservations={showObservations}
      showTasks={showTasks}
      onToggleObservations={() => setShowObservations(v => !v)}
      onToggleTasks={() => setShowTasks(v => !v)}
    />
  )

  return (
    <div className="flex h-full w-full" style={{ height: 'calc(100dvh - 60px)' }}>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-[280px] flex-shrink-0"
        style={{ borderRight: `1px solid ${C.border}`, background: C.surface }}
      >
        {filterPanel}
      </aside>

      {/* Map area */}
      <div className="relative flex-1 flex flex-col">
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-3 py-2 z-10 flex-shrink-0"
          style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex items-center gap-2">
            <button type="button" onClick={locateMe} className="flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs" aria-label="Show my location"><Crosshair className="h-4 w-4" /> Locate me</button>
            {loading ? (
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="animate-bounce w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: C.emerald, animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            ) : (
              <MapPin className="h-4 w-4" style={{ color: C.emerald }} />
            )}
            <span style={{ ...HEAD, fontSize: 13, fontWeight: 500, color: C.text }}>
              {loading ? 'Loading…' : `${markers.length} observation${markers.length !== 1 ? 's' : ''} · ${taskMarkers.length} task${taskMarkers.length !== 1 ? 's' : ''}`}
            </span>
            {active && !loading && (
              <span
                style={{
                  ...HEAD,
                  fontSize: 11,
                  fontWeight: 600,
                  background: "rgba(16,185,129,0.12)",
                  color: C.emerald,
                  borderRadius: 9999,
                  padding: "1px 8px",
                }}
              >
                Filtered
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {active && (
              <button
                onClick={handleClearFilters}
                className="hidden md:flex items-center gap-1 text-xs"
                style={{ color: C.muted, background: "none", border: "none", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = C.text}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = C.muted}
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
            {/* Mobile filter button */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm"
              style={{
                ...HEAD,
                fontWeight: 500,
                background: "transparent",
                border: `1px solid ${C.border}`,
                color: C.text,
                cursor: "pointer",
              }}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {active && (
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ background: C.emeraldBtn }}
                />
              )}
            </button>
          </div>
        </div>
        {error && <div role="alert" className="z-10 border-b border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
        {obsError && <div role="alert" className="z-10 border-b border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {obsError}{obsUpdatedAt ? ` Showing observations as of ${obsUpdatedAt.toLocaleTimeString()}.` : ' No observation data is available.'}
        </div>}
        {taskError && <div role="alert" className="z-10 border-b border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {taskError}{taskUpdatedAt ? ` Showing tasks as of ${taskUpdatedAt.toLocaleTimeString()}.` : ' No task data is available.'}
        </div>}
        {(truncated || taskTruncated) && <div role="status" className="z-10 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {truncated && `Showing the newest ${markers.length} of ${totalMarkers} matching observations. `}
          {taskTruncated && `Showing the newest ${taskMarkers.length} of ${totalTaskMarkers} matching tasks. `}
          Narrow the filters to see a complete set.
        </div>}

        {/* Map container */}
        <div className="relative flex-1">
          <div ref={mapContainerRef} className="absolute inset-0" />

          {/* Offline fallback: tiles cannot be pre-downloaded (OSM tile policy) */}
          {offlineRows !== null && (
            <div className="absolute inset-0 z-20 overflow-y-auto" style={{ background: C.bg }}>
              <div className="px-4 py-3" style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
                <p style={{ ...HEAD, fontSize: 14, fontWeight: 600, color: C.text }}>Offline map not downloaded</p>
                <p className="mt-1 text-xs" style={{ ...BODY, color: C.muted }}>
                  Map tiles cannot be downloaded in advance under the OpenStreetMap tile policy.
                  Showing your cached records instead — tap one to open it.
                </p>
              </div>
              {offlineRows.length === 0 ? (
                <p className="px-4 py-6 text-sm" style={{ ...BODY, color: C.muted }}>
                  No cached records on this phone. Preload offline data from Settings while online.
                </p>
              ) : (
                <ul>
                  {offlineRows.map((row) => (
                    <li key={`${row.kind}-${row.id}`}>
                      <button
                        type="button"
                        onClick={() => navigate(row.kind === "observation" ? `/observations/${row.id}` : `/actions/${row.id}`)}
                        className="w-full px-4 py-3 text-left"
                        style={{ borderBottom: `1px solid ${C.borderMid}` }}
                      >
                        <span className="flex items-center gap-2">
                          <span style={{ width: 10, height: 10, borderRadius: row.kind === "observation" ? 9999 : 2, background: PRIORITY_COLORS[row.priority as keyof typeof PRIORITY_COLORS] ?? C.muted, display: "inline-block" }} />
                          <span className="text-xs" style={{ ...HEAD, color: C.muted }}>{row.referenceNumber}</span>
                          <span className="text-xs uppercase" style={{ ...HEAD, color: C.dim }}>{row.kind}</span>
                        </span>
                        <span className="mt-0.5 block text-sm" style={{ ...BODY, color: C.text }}>{row.title}</span>
                        {row.locationName && <span className="block text-xs" style={{ ...BODY, color: C.muted }}>{row.locationName}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div
              className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
              style={{ background: "rgba(13,17,23,0.5)" }}
            >
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="animate-bounce w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: C.emerald, animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state overlay */}
          {!loading && markers.length === 0 && taskMarkers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div
                className="backdrop-blur-sm rounded-xl px-6 py-5 text-center max-w-xs pointer-events-auto"
                style={{ background: "rgba(22,27,34,0.92)", border: `1px solid ${C.border}` }}
              >
                <MapPin className="h-8 w-8 mx-auto mb-2" style={{ color: C.dim }} />
                <p style={{ ...HEAD, fontSize: 14, fontWeight: 500, color: C.muted }}>
                  No observations or tasks with coordinates found
                </p>
                {active && (
                  <button
                    onClick={handleClearFilters}
                    className="mt-3 text-xs"
                    style={{ color: C.emerald, background: "none", border: "none", cursor: "pointer" }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl max-h-[80dvh] flex flex-col"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          >
            <div
              className="flex items-center justify-between px-4 pt-4 pb-2"
              style={{ borderBottom: `1px solid ${C.border}` }}
            >
              <span style={{ ...HEAD, fontWeight: 600, fontSize: 14, color: C.text }}>Filter Map</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded-md"
                style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filterPanel}
            </div>
            <div className="p-4" style={{ borderTop: `1px solid ${C.border}` }}>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-full py-2.5 rounded-lg text-sm font-medium"
                style={{ background: C.emeraldBtn, color: "#fff", border: "none", ...HEAD, cursor: "pointer" }}
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
