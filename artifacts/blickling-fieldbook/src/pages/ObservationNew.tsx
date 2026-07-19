import React, { useState, useEffect, useRef } from "react"
import { useCreateObservation, useListCategories, useListLocations } from "@workspace/api-client-react"
import { useLocation } from "wouter"
import { ChevronRight, ChevronLeft, MapPin, Camera, Save, Check } from "lucide-react"
import PhotoUpload from "@/components/PhotoUpload"
import PhotoGallery from "@/components/PhotoGallery"
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

// Fix leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

const C = {
  bg: "#0d1117",
  surface: "#161b22",
  border: "#30363d",
  borderMid: "#21262d",
  text: "#e6edf3",
  muted: "#8b949e",
  dim: "#484f58",
  emerald: "#10b981",
  emeraldDark: "#0d9268",
  emeraldDim: "#065f46",
  emeraldTint: "rgba(16,185,129,0.08)",
  urgent: "#f85149",
  urgentTint: "rgba(248,81,73,0.12)",
  high: "#d29922",
  highTint: "rgba(210,153,34,0.12)",
  blue: "#58a6ff",
  blueTint: "rgba(88,166,255,0.12)",
  purple: "#a78bfa",
}

const HEAD = { fontFamily: "'Space Grotesk', sans-serif" }
const BODY = { fontFamily: "'Inter', sans-serif" }

function priorityConfig(p: string) {
  switch (p) {
    case "urgent": return { color: "#f85149", bg: "rgba(248,81,73,0.12)", label: "Urgent" }
    case "high":   return { color: "#d29922", bg: "rgba(210,153,34,0.12)", label: "High" }
    case "normal": return { color: "#58a6ff", bg: "rgba(88,166,255,0.12)", label: "Normal" }
    default:       return { color: "#8b949e", bg: "rgba(139,148,158,0.12)", label: "Low" }
  }
}

function priorityBorderColor(p: string) {
  switch (p) {
    case "urgent": return "#f85149"
    case "high":   return "#d29922"
    case "normal": return "#58a6ff"
    default:       return "#8b949e"
  }
}

// Blickling Estate centre — default map view when no coords yet
const ESTATE_CENTER: [number, number] = [52.8406, 1.2977]
const ESTATE_ZOOM = 14

/** Listens for map clicks and calls onPin with the tapped coordinates */
function MapPinHandler({ onPin }: { onPin: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPin(e.latlng.lat, e.latlng.lng) } })
  return null
}

interface PendingPhoto {
  storageKey: string
  originalFilename: string
  mimeType: string
  fileSize: number
}

const inputStyle: React.CSSProperties = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  color: C.text,
  borderRadius: "0.625rem",
  padding: "0.625rem 0.75rem",
  fontSize: 14,
  width: "100%",
  outline: "none",
  ...BODY,
}

const labelStyle: React.CSSProperties = {
  ...HEAD,
  fontSize: 13,
  fontWeight: 600,
  color: C.muted,
  display: "block",
  marginBottom: 6,
}

const STEP_LABELS = ["Location", "Category", "Details", "Photos", "Review"]

export default function ObservationNew() {
  const [, setLocation] = useLocation()
  const createObservation = useCreateObservation()
  const { data: categories } = useListCategories()
  const { data: locations } = useListLocations()

  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    categoryId: "",
    priority: "normal" as any,
    observedAt: new Date().toISOString().slice(0,16),
    latitude: null as number | null,
    longitude: null as number | null,
    gpsAccuracy: null as number | null,
    namedLocationId: "",
    safetyIssue: false,
    publicAccessAffected: false,
    machineryRequired: false,
    followUpRequired: true
  })

  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>()

  const handleNext = () => setStep(s => Math.min(s + 1, 5))
  const handlePrev = () => setStep(s => Math.max(s - 1, 1))

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setFormData(d => ({
          ...d,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          gpsAccuracy: pos.coords.accuracy ?? null,
        }))
      })
    }
  }

  const handlePhotoUploaded = (image: PendingPhoto) => {
    setPendingPhotos(prev => [...(prev || []), image])
  }

  const handleSubmit = (status: 'draft' | 'submitted') => {
    createObservation.mutate(
      {
        data: {
          title: formData.title,
          description: formData.description,
          categoryId: Number(formData.categoryId),
          priority: formData.priority,
          observedAt: new Date(formData.observedAt).toISOString(),
          status,
          latitude: formData.latitude || undefined,
          longitude: formData.longitude || undefined,
          namedLocationId: formData.namedLocationId ? Number(formData.namedLocationId) : undefined,
          safetyIssue: formData.safetyIssue,
          publicAccessAffected: formData.publicAccessAffected,
          machineryRequired: formData.machineryRequired,
          followUpRequired: formData.followUpRequired
        }
      },
      {
        onSuccess: async (data) => {
          for (const photo of (pendingPhotos || [])) {
            await fetch(`/api/observations/${data.id}/images`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...photo, imageType: 'observation' })
            })
          }
          setLocation(`/observations/${data.id}`)
        }
      }
    )
  }

  const canProceed = () => {
    if (step === 2) return formData.title.trim().length > 0 && formData.categoryId
    return true
  }

  const pendingGalleryItems = (pendingPhotos || []).map((p, i) => ({
    id: i,
    storageKey: p.storageKey,
    originalFilename: p.originalFilename,
    mimeType: p.mimeType,
    caption: null,
  }))

  // Pin-on-map state
  const [locationMode, setLocationMode] = useState<"gps" | "pin" | null>(null)
  const [pinnedPos, setPinnedPos] = useState<{ lat: number; lng: number } | null>(null)

  const handlePinPlaced = (lat: number, lng: number) => {
    setPinnedPos({ lat, lng })
    setFormData(d => ({ ...d, latitude: lat, longitude: lng, gpsAccuracy: null }))
  }

  const handleSelectGpsMode = () => {
    setLocationMode("gps")
    setPinnedPos(null)
    handleGetLocation()
  }

  const handleSelectPinMode = () => {
    setLocationMode("pin")
    // Clear GPS coords when switching to pin mode (pin replaces on click)
    setFormData(d => ({ ...d, latitude: null, longitude: null, gpsAccuracy: null }))
    setPinnedPos(null)
  }

  const [gpsBtnHover, setGpsBtnHover] = useState(false)
  const [nextBtnHover, setNextBtnHover] = useState(false)
  const [submitBtnHover, setSubmitBtnHover] = useState(false)
  const [draftBtnHover, setDraftBtnHover] = useState(false)

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 0 40px" }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ ...HEAD, fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>New Observation</h1>
        <p style={{ ...BODY, fontSize: 13, color: C.muted, marginTop: 4 }}>Record a field observation across the estate</p>
      </div>

      {/* Step Indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        {STEP_LABELS.map((label, i) => {
          const n = i + 1
          const completed = step > n
          const current = step === n
          return (
            <React.Fragment key={n}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: completed ? C.emerald : current ? "transparent" : C.dim,
                  border: current ? `2px solid ${C.emerald}` : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.2s",
                }}>
                  {completed
                    ? <Check size={13} color="#fff" strokeWidth={3} />
                    : <span style={{ ...HEAD, fontSize: 11, fontWeight: 700, color: current ? C.emerald : "#fff" }}>{n}</span>
                  }
                </div>
                <span style={{
                  ...HEAD,
                  fontSize: 12,
                  fontWeight: 600,
                  color: current ? C.text : completed ? C.emerald : C.dim,
                  display: "none",
                  ...(current || completed ? { display: "inline" } : {}),
                }}>
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div style={{ flex: 1, height: 1, background: step > n ? C.emerald : C.borderMid, transition: "background 0.3s" }} />
              )}
            </React.Fragment>
          )
        })}
        <span style={{ ...BODY, fontSize: 12, color: C.muted, marginLeft: 8, whiteSpace: "nowrap" }}>
          Step {step} of 5
        </span>
      </div>

      {/* Step Panel */}
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: "0.75rem",
        padding: "1.5rem",
        marginBottom: 16,
      }}>
        {/* STEP 1: Location */}
        {step === 1 && (
          <div>
            <h2 style={{ ...HEAD, fontSize: 16, fontWeight: 700, color: C.text, margin: "0 0 6px" }}>
              Where is this?
            </h2>
            <p style={{ ...BODY, fontSize: 13, color: C.muted, margin: "0 0 20px" }}>
              Use your device location, drop a pin on the map, or choose a named area.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* ── Option A: GPS ── */}
              <button
                onClick={handleSelectGpsMode}
                onMouseEnter={() => setGpsBtnHover(true)}
                onMouseLeave={() => setGpsBtnHover(false)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  background: locationMode === "gps" && formData.latitude ? C.emeraldTint : gpsBtnHover ? C.borderMid : C.bg,
                  border: `1px solid ${locationMode === "gps" && formData.latitude ? C.emerald : C.border}`,
                  borderRadius: "0.625rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  textAlign: "left",
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                  background: locationMode === "gps" && formData.latitude ? C.emeraldTint : C.borderMid,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <MapPin size={18} color={locationMode === "gps" && formData.latitude ? C.emerald : C.muted} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...HEAD, fontSize: 14, fontWeight: 600, color: locationMode === "gps" && formData.latitude ? C.emerald : C.text }}>
                    {locationMode === "gps" && formData.latitude ? "GPS location captured" : "Use my current location"}
                  </div>
                  {locationMode === "gps" && formData.latitude
                    ? <div style={{ ...BODY, fontSize: 12, color: C.muted, marginTop: 2 }}>
                        {formData.latitude.toFixed(5)}, {formData.longitude?.toFixed(5)}
                        {formData.gpsAccuracy != null && ` · ±${Math.round(formData.gpsAccuracy)}m`}
                      </div>
                    : <div style={{ ...BODY, fontSize: 12, color: C.dim, marginTop: 2 }}>Requires device location permission</div>
                  }
                </div>
                {locationMode === "gps" && formData.latitude && <Check size={18} color={C.emerald} strokeWidth={2.5} />}
              </button>

              {/* ── Option B: Drop a pin ── */}
              <button
                onClick={handleSelectPinMode}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  background: locationMode === "pin" ? C.blueTint : C.bg,
                  border: `1px solid ${locationMode === "pin" ? C.blue : C.border}`,
                  borderRadius: "0.625rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  textAlign: "left",
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                  background: locationMode === "pin" ? C.blueTint : C.borderMid,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {/* crosshair icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={locationMode === "pin" ? C.blue : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...HEAD, fontSize: 14, fontWeight: 600, color: locationMode === "pin" ? C.blue : C.text }}>
                    {locationMode === "pin" && pinnedPos ? "Pin location set" : "Drop a pin on the map"}
                  </div>
                  {locationMode === "pin" && pinnedPos
                    ? <div style={{ ...BODY, fontSize: 12, color: C.muted, marginTop: 2 }}>
                        {pinnedPos.lat.toFixed(5)}, {pinnedPos.lng.toFixed(5)} · tap map to move
                      </div>
                    : <div style={{ ...BODY, fontSize: 12, color: C.dim, marginTop: 2 }}>Tap anywhere on the estate map</div>
                  }
                </div>
                {locationMode === "pin" && pinnedPos && <Check size={18} color={C.blue} strokeWidth={2.5} />}
              </button>

              {/* ── Interactive pin map ── */}
              {locationMode === "pin" && (
                <div style={{
                  borderRadius: "0.625rem",
                  overflow: "hidden",
                  border: `1px solid ${C.blue}`,
                  position: "relative",
                }}>
                  {/* instruction banner */}
                  <div style={{
                    position: "absolute",
                    top: 10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 1000,
                    background: "rgba(13,17,23,0.88)",
                    border: `1px solid ${C.blue}`,
                    borderRadius: 9999,
                    padding: "5px 14px",
                    ...BODY,
                    fontSize: 12,
                    color: C.blue,
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                  }}>
                    {pinnedPos ? "Tap to move the pin · drag the marker to fine-tune" : "Tap the map to drop a pin"}
                  </div>

                  <MapContainer
                    key="pin-map"
                    center={pinnedPos ? [pinnedPos.lat, pinnedPos.lng] : ESTATE_CENTER}
                    zoom={pinnedPos ? 16 : ESTATE_ZOOM}
                    style={{ height: 300, width: "100%" }}
                    scrollWheelZoom
                    doubleClickZoom={false}
                    attributionControl={false}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MapPinHandler onPin={handlePinPlaced} />
                    {pinnedPos && (
                      <Marker
                        position={[pinnedPos.lat, pinnedPos.lng]}
                        draggable
                        eventHandlers={{
                          dragend(e) {
                            const pos = (e.target as L.Marker).getLatLng()
                            handlePinPlaced(pos.lat, pos.lng)
                          }
                        }}
                      />
                    )}
                  </MapContainer>
                </div>
              )}

              {/* ── GPS preview map ── */}
              {locationMode === "gps" && formData.latitude && formData.longitude && (
                <div style={{ borderRadius: "0.5rem", overflow: "hidden", border: `1px solid ${C.emerald}`, height: 150 }}>
                  <MapContainer
                    key="gps-map"
                    center={[formData.latitude, formData.longitude]}
                    zoom={16}
                    style={{ height: "150px", width: "100%" }}
                    zoomControl={false}
                    attributionControl={false}
                    dragging={false}
                    scrollWheelZoom={false}
                    doubleClickZoom={false}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[formData.latitude, formData.longitude]} />
                  </MapContainer>
                </div>
              )}

              {/* ── Divider ── */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
                <div style={{ flex: 1, height: 1, background: C.borderMid }} />
                <span style={{ ...BODY, fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.05em" }}>Also add</span>
                <div style={{ flex: 1, height: 1, background: C.borderMid }} />
              </div>

              {/* ── Named location (always available alongside coords) ── */}
              <div>
                <label style={labelStyle}>Named Estate Area <span style={{ color: C.muted, fontWeight: 400 }}>(optional)</span></label>
                <select
                  style={{ ...inputStyle }}
                  value={formData.namedLocationId}
                  onChange={e => setFormData(d => ({ ...d, namedLocationId: e.target.value }))}
                >
                  <option value="" style={{ background: C.bg, color: C.dim }}>-- Select area --</option>
                  {locations?.map(l => <option key={l.id} value={l.id} style={{ background: C.bg, color: C.text }}>{l.name}</option>)}
                </select>
              </div>

            </div>
          </div>
        )}

        {/* STEP 2: Category */}
        {step === 2 && (
          <div>
            <h2 style={{ ...HEAD, fontSize: 16, fontWeight: 700, color: C.text, margin: "0 0 20px" }}>
              What are you reporting?
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={labelStyle}>Category <span style={{ color: C.urgent }}>*</span></label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {categories?.map(c => {
                    const selected = formData.categoryId === String(c.id)
                    return (
                      <button
                        key={c.id}
                        onClick={() => setFormData(d => ({ ...d, categoryId: String(c.id) }))}
                        style={{
                          padding: "12px",
                          textAlign: "left",
                          background: selected ? C.emeraldTint : C.bg,
                          border: `1px solid ${selected ? C.emerald : C.border}`,
                          borderRadius: "0.625rem",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: c.displayColour || C.dim,
                            flexShrink: 0,
                          }} />
                          <span style={{ ...BODY, fontSize: 13, color: selected ? C.emerald : C.text, fontWeight: selected ? 600 : 400 }}>
                            {c.name}
                          </span>
                          {selected && <Check size={14} color={C.emerald} style={{ marginLeft: "auto" }} />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Brief Title <span style={{ color: C.urgent }}>*</span></label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Fallen branch on Main Drive"
                  value={formData.title}
                  onChange={e => setFormData(d => ({ ...d, title: e.target.value }))}
                  maxLength={100}
                  onFocus={e => (e.target.style.borderColor = C.emerald)}
                  onBlur={e => (e.target.style.borderColor = C.border)}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Details */}
        {step === 3 && (
          <div>
            <h2 style={{ ...HEAD, fontSize: 16, fontWeight: 700, color: C.text, margin: "0 0 20px" }}>
              Details
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                  placeholder="Additional context or details..."
                  value={formData.description}
                  onChange={e => setFormData(d => ({ ...d, description: e.target.value }))}
                  onFocus={e => (e.target.style.borderColor = C.emerald)}
                  onBlur={e => (e.target.style.borderColor = C.border)}
                />
              </div>

              <div>
                <label style={labelStyle}>Priority</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(['low', 'normal', 'high', 'urgent'] as const).map(p => {
                    const cfg = priorityConfig(p)
                    const selected = formData.priority === p
                    return (
                      <button
                        key={p}
                        onClick={() => setFormData(d => ({ ...d, priority: p as any }))}
                        style={{
                          flex: 1,
                          padding: "8px 4px",
                          background: selected ? cfg.bg : "transparent",
                          border: `1px solid ${selected ? cfg.color : C.border}`,
                          borderRadius: "0.625rem",
                          cursor: "pointer",
                          transition: "all 0.15s",
                          ...HEAD,
                          fontSize: 11,
                          fontWeight: 700,
                          color: selected ? cfg.color : C.dim,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { id: 'safetyIssue', label: 'Safety Issue', desc: 'Poses a risk to people or property' },
                  { id: 'publicAccessAffected', label: 'Public Access Affected', desc: 'Path, gate or entrance is blocked' },
                  { id: 'machineryRequired', label: 'Machinery Required', desc: 'Needs tractor, chainsaw or heavy equipment' },
                  { id: 'followUpRequired', label: 'Follow-up Required', desc: 'Needs a return visit or action' }
                ].map(flag => {
                  const checked = formData[flag.id as keyof typeof formData] as boolean
                  return (
                    <button
                      key={flag.id}
                      type="button"
                      onClick={() => setFormData(d => ({ ...d, [flag.id]: !d[flag.id as keyof typeof d] }))}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: checked ? C.emeraldTint : C.bg,
                        border: `1px solid ${checked ? C.emerald : C.border}`,
                        borderRadius: "0.625rem",
                        padding: "10px 14px",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s",
                        width: "100%",
                      }}
                    >
                      {/* Toggle pill */}
                      <div style={{
                        width: 36,
                        height: 20,
                        borderRadius: 9999,
                        background: checked ? C.emerald : C.dim,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 3px",
                        transition: "background 0.2s",
                        flexShrink: 0,
                        justifyContent: checked ? "flex-end" : "flex-start",
                      }}>
                        <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff" }} />
                      </div>
                      <div>
                        <div style={{ ...HEAD, fontSize: 13, fontWeight: 600, color: checked ? C.emerald : C.text }}>{flag.label}</div>
                        <div style={{ ...BODY, fontSize: 12, color: C.muted, marginTop: 2 }}>{flag.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Photos */}
        {step === 4 && (
          <div>
            <h2 style={{ ...HEAD, fontSize: 16, fontWeight: 700, color: C.text, margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
              <Camera size={18} color={C.muted} /> Photographs
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <PhotoUpload
                onUploaded={handlePhotoUploaded}
                label="Take / Add Photo"
              />

              {(pendingPhotos && pendingPhotos.length > 0) ? (
                <div>
                  <p style={{ ...BODY, fontSize: 13, color: C.muted, marginBottom: 10 }}>
                    {pendingPhotos.length} photo{pendingPhotos.length !== 1 ? "s" : ""} ready to upload
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {pendingPhotos.map((p, i) => (
                      <div key={i} style={{ position: "relative", borderRadius: "0.5rem", overflow: "hidden", border: `1px solid ${C.border}`, background: C.bg, aspectRatio: "1" }}>
                        <img
                          src={`/api/storage${p.storageKey}`}
                          alt={p.originalFilename}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                        <button
                          type="button"
                          onClick={() => setPendingPhotos(prev => (prev || []).filter((_, idx) => idx !== i))}
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            background: "rgba(0,0,0,0.7)",
                            border: "none",
                            borderRadius: "50%",
                            padding: 3,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <Camera size={32} color={C.dim} style={{ margin: "0 auto 8px" }} />
                  <p style={{ ...BODY, fontSize: 13, color: C.muted, margin: 0 }}>No photos added yet</p>
                  <p style={{ ...BODY, fontSize: 12, color: C.dim, marginTop: 4 }}>Photos are optional but helpful for records</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: Review */}
        {step === 5 && (
          <div>
            <h2 style={{ ...HEAD, fontSize: 16, fontWeight: 700, color: C.text, margin: "0 0 20px" }}>
              Review &amp; Submit
            </h2>
            <div style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: "0.625rem",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginBottom: 20,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ ...BODY, fontSize: 11, color: C.muted, marginBottom: 2 }}>Title</div>
                  <div style={{ ...HEAD, fontSize: 14, fontWeight: 600, color: C.text }}>{formData.title || <span style={{ color: C.dim }}>—</span>}</div>
                </div>
                {formData.priority && (() => {
                  const cfg = priorityConfig(formData.priority)
                  return (
                    <div style={{
                      background: cfg.bg,
                      color: cfg.color,
                      borderRadius: 9999,
                      padding: "2px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                      ...HEAD,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}>{cfg.label}</div>
                  )
                })()}
              </div>

              {formData.description && (
                <div>
                  <div style={{ ...BODY, fontSize: 11, color: C.muted, marginBottom: 2 }}>Description</div>
                  <div style={{ ...BODY, fontSize: 13, color: C.text }}>{formData.description}</div>
                </div>
              )}

              {(formData.latitude || formData.namedLocationId) && (
                <div>
                  <div style={{ ...BODY, fontSize: 11, color: C.muted, marginBottom: 2 }}>Location</div>
                  <div style={{ ...BODY, fontSize: 13, color: C.text }}>
                    {formData.latitude
                      ? `GPS: ${formData.latitude.toFixed(5)}, ${formData.longitude?.toFixed(5)}`
                      : locations?.find(l => String(l.id) === formData.namedLocationId)?.name}
                  </div>
                </div>
              )}

              {(pendingPhotos && pendingPhotos.length > 0) && (
                <div>
                  <div style={{ ...BODY, fontSize: 11, color: C.muted, marginBottom: 2 }}>Photos</div>
                  <div style={{ ...BODY, fontSize: 13, color: C.text }}>{pendingPhotos.length} photo{pendingPhotos.length !== 1 ? "s" : ""} queued</div>
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {formData.safetyIssue && (
                  <span style={{
                    background: "rgba(248,81,73,0.12)", color: "#f85149", borderRadius: 9999,
                    padding: "2px 10px", fontSize: 11, fontWeight: 600, ...HEAD,
                  }}>Safety Issue</span>
                )}
                {formData.publicAccessAffected && (
                  <span style={{
                    background: "rgba(210,153,34,0.12)", color: "#d29922", borderRadius: 9999,
                    padding: "2px 10px", fontSize: 11, fontWeight: 600, ...HEAD,
                  }}>Access Blocked</span>
                )}
                {formData.machineryRequired && (
                  <span style={{
                    background: C.borderMid, color: C.muted, borderRadius: 9999,
                    padding: "2px 10px", fontSize: 11, fontWeight: 600, ...HEAD,
                  }}>Machinery</span>
                )}
                {formData.followUpRequired && (
                  <span style={{
                    background: C.emeraldTint, color: C.emerald, borderRadius: 9999,
                    padding: "2px 10px", fontSize: 11, fontWeight: 600, ...HEAD,
                  }}>Follow-up</span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => handleSubmit('submitted')}
                disabled={createObservation.isPending}
                onMouseEnter={() => setSubmitBtnHover(true)}
                onMouseLeave={() => setSubmitBtnHover(false)}
                style={{
                  width: "100%",
                  height: 48,
                  background: createObservation.isPending ? C.emeraldDim : submitBtnHover ? C.emeraldDark : C.emerald,
                  border: "none",
                  borderRadius: "0.625rem",
                  color: "#fff",
                  ...HEAD,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: createObservation.isPending ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {createObservation.isPending ? (
                  <>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[0,1,2].map(i => (
                        <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", animation: `bounce 1s ${i * 0.15}s infinite` }} />
                      ))}
                    </div>
                    Submitting...
                  </>
                ) : "Submit Observation"}
              </button>
              <button
                onClick={() => handleSubmit('draft')}
                disabled={createObservation.isPending}
                onMouseEnter={() => setDraftBtnHover(true)}
                onMouseLeave={() => setDraftBtnHover(false)}
                style={{
                  width: "100%",
                  height: 44,
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: "0.625rem",
                  color: draftBtnHover ? C.text : C.muted,
                  ...HEAD,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: createObservation.isPending ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  ...(draftBtnHover ? { background: C.borderMid } : {}),
                }}
              >
                <Save size={15} /> Save as Draft
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      {step < 5 && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 0",
        }}>
          {step > 1 ? (
            <button
              onClick={handlePrev}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: C.muted,
                ...HEAD,
                fontSize: 14,
                fontWeight: 600,
                padding: "8px 0",
              }}
            >
              <ChevronLeft size={16} /> Back
            </button>
          ) : <div />}
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            onMouseEnter={() => setNextBtnHover(true)}
            onMouseLeave={() => setNextBtnHover(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: !canProceed() ? C.emeraldDim : nextBtnHover ? C.emeraldDark : C.emerald,
              border: "none",
              borderRadius: "0.625rem",
              color: "#fff",
              ...HEAD,
              fontSize: 14,
              fontWeight: 700,
              padding: "10px 20px",
              cursor: !canProceed() ? "not-allowed" : "pointer",
              opacity: !canProceed() ? 0.5 : 1,
              transition: "all 0.15s",
            }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
