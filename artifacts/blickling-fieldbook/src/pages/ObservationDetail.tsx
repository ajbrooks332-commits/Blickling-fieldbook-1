import React, { useState, useEffect } from "react"
import { useGetObservation, useCreateAction, useUpdateObservationStatus, useCreateNote, getGetObservationQueryKey } from "@workspace/api-client-react"
import { useParams, useLocation, Link } from "wouter"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertTriangle, ArrowUp, Minus, ArrowDown, MapPin, Edit, CheckCircle2, AlertCircle, Map, MessageSquare, ChevronRight, Camera, ArrowLeft, ShieldAlert, Activity } from "lucide-react"
import { formatShortDate, formatDate, getInitials } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import PhotoGallery from "@/components/PhotoGallery"
import PhotoUpload from "@/components/PhotoUpload"

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

function statusColor(s: string) {
  switch (s) {
    case "action_required": return "#f85149"
    case "submitted":       return "#58a6ff"
    case "under_review":    return "#a78bfa"
    case "monitoring":      return "#34d399"
    case "resolved":        return "#10b981"
    case "closed":          return "#484f58"
    case "cancelled":       return "#484f58"
    default:                return "#8b949e"
  }
}
function statusBg(s: string) { return statusColor(s) + "1a" }
function statusLabel(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) }

interface ObservationImage {
  id: number
  storageKey: string
  originalFilename: string
  caption?: string | null
  mimeType: string
}

const PriorityIcon = ({ p, size = 4 }: { p: string; size?: number }) => {
  const cls = `w-${size} h-${size}`
  switch (p) {
    case 'urgent': return <AlertTriangle className={cls} />
    case 'high':   return <ArrowUp className={cls} />
    case 'normal': return <Minus className={cls} />
    case 'low':    return <ArrowDown className={cls} />
    default:       return null
  }
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: "0.75rem",
      overflow: "hidden",
      ...style,
    }}>
      {children}
    </div>
  )
}

function CardHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: "12px 16px",
      borderBottom: `1px solid ${C.borderMid}`,
      display: "flex",
      alignItems: "center",
      gap: 8,
    }}>
      {children}
    </div>
  )
}

function CardHeadTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ ...HEAD, color: C.text, fontSize: 14, fontWeight: 600, margin: 0 }}>
      {children}
    </h2>
  )
}

export default function ObservationDetail() {
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()

  const { data: obs, isLoading } = useGetObservation(id, { query: { enabled: !!id, queryKey: getGetObservationQueryKey(id) } })
  const updateStatus = useUpdateObservationStatus()
  const createNote = useCreateNote()

  const [noteOpen, setNoteOpen] = useState(false)
  const [noteBody, setNoteBody] = useState("")
  const [noteBodyFocused, setNoteBodyFocused] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)

  const [images, setImages] = useState<ObservationImage[]>([])
  const [imagesLoading, setImagesLoading] = useState(false)

  const fetchImages = async () => {
    if (!id) return
    setImagesLoading(true)
    try {
      const res = await fetch(`/api/observations/${id}/images`)
      if (res.ok) {
        const data = await res.json()
        setImages(Array.isArray(data) ? data : (data.images || []))
      }
    } catch {
      // silently fail
    } finally {
      setImagesLoading(false)
    }
  }

  useEffect(() => {
    if (id) fetchImages()
  }, [id])

  const handlePhotoUploaded = async (image: { storageKey: string; originalFilename: string; mimeType: string; fileSize: number }) => {
    await fetch(`/api/observations/${id}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...image, imageType: 'observation' })
    })
    fetchImages()
  }

  const handleDeleteImage = async (imageId: number) => {
    await fetch(`/api/observations/${id}/images/${imageId}`, { method: 'DELETE' })
    setImages(prev => prev.filter(img => img.id !== imageId))
  }

  if (isLoading || !obs) {
    return (
      <div className="flex justify-center items-center p-12 gap-2">
        <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: C.emerald, animationDelay: "0ms" }} />
        <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: C.emerald, animationDelay: "150ms" }} />
        <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: C.emerald, animationDelay: "300ms" }} />
      </div>
    )
  }

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteBody.trim()) return
    createNote.mutate(
      { data: { body: noteBody, observationId: id } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetObservationQueryKey(id) })
          setNoteOpen(false)
          setNoteBody("")
        }
      }
    )
  }

  const handleStatusUpdate = (newStatus: string) => {
    updateStatus.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetObservationQueryKey(id) })
          setStatusOpen(false)
        }
      }
    )
  }

  const pc = priorityConfig(obs.priority)

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingBottom: 48 }}>

      {/* Sticky header bar */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 flex-wrap"
        style={{
          background: C.bg,
          borderBottom: `1px solid ${C.borderMid}`,
          padding: "10px 0 10px 0",
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => setLocation("/observations")}
          className="flex items-center gap-1"
          style={{
            background: "transparent",
            border: `1px solid ${C.border}`,
            borderRadius: "0.5rem",
            color: C.muted,
            fontSize: 13,
            padding: "5px 10px",
            cursor: "pointer",
            ...HEAD,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        <span
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            color: C.muted,
            background: C.borderMid,
            borderRadius: "9999px",
            padding: "3px 10px",
          }}
        >
          {obs.referenceNumber}
        </span>

        {obs.status === "action_required" && obs.actions && obs.actions.length > 0 ? (
          obs.actions.length === 1 ? (
            <button
              onClick={() => setLocation(`/actions/${obs.actions[0].id}`)}
              style={{
                background: statusBg(obs.status),
                color: statusColor(obs.status),
                borderRadius: "9999px",
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
                textDecorationStyle: "dotted",
                ...HEAD,
              }}
            >
              {statusLabel(obs.status)}
            </button>
          ) : (
            <button
              onClick={() => document.getElementById("linked-actions")?.scrollIntoView({ behavior: "smooth" })}
              style={{
                background: statusBg(obs.status),
                color: statusColor(obs.status),
                borderRadius: "9999px",
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
                textDecorationStyle: "dotted",
                ...HEAD,
              }}
            >
              {statusLabel(obs.status)}
            </button>
          )
        ) : (
          <span
            style={{
              background: statusBg(obs.status),
              color: statusColor(obs.status),
              borderRadius: "9999px",
              padding: "3px 10px",
              fontSize: 11,
              fontWeight: 600,
              ...HEAD,
            }}
          >
            {statusLabel(obs.status)}
          </span>
        )}

        <span
          className="flex items-center gap-1"
          style={{
            background: pc.bg,
            color: pc.color,
            borderRadius: "9999px",
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 600,
            ...HEAD,
          }}
        >
          <PriorityIcon p={obs.priority} size={3} />
          {pc.label}
        </span>

        {/* Actions: Edit + Create Action */}
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => setLocation(`/observations/${id}/edit`)}
            className="flex items-center gap-1.5"
            style={{
              background: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: "0.5rem",
              color: C.muted,
              fontSize: 13,
              fontWeight: 500,
              padding: "5px 12px",
              cursor: "pointer",
              ...HEAD,
            }}
          >
            <Edit className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={() => setLocation(`/actions/new?observationId=${id}`)}
            className="flex items-center gap-1.5"
            style={{
              background: C.emerald,
              border: "none",
              borderRadius: "0.5rem",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              padding: "5px 12px",
              cursor: "pointer",
              ...HEAD,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.emeraldDark }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.emerald }}
          >
            Create Action
          </button>
        </div>
      </div>

      {/* Title with priority left border */}
      <div
        style={{
          borderLeft: `4px solid ${priorityBorderColor(obs.priority)}`,
          paddingLeft: 16,
          marginBottom: 24,
        }}
      >
        <h1 style={{ ...HEAD, fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
          {obs.title}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="md:col-span-2 space-y-5">

          {/* Details card */}
          <SectionCard>
            <CardHead>
              <CardHeadTitle>Details</CardHeadTitle>
            </CardHead>
            <div style={{ padding: 16 }} className="space-y-5">
              {/* Priority + Category badges */}
              <div className="flex flex-wrap gap-2">
                <span
                  className="flex items-center gap-1.5"
                  style={{
                    background: pc.bg,
                    color: pc.color,
                    borderRadius: "9999px",
                    padding: "4px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    ...HEAD,
                  }}
                >
                  <PriorityIcon p={obs.priority} size={3} />
                  {pc.label} Priority
                </span>
                <span
                  className="flex items-center gap-1.5"
                  style={{
                    background: C.borderMid,
                    color: C.muted,
                    borderRadius: "9999px",
                    padding: "4px 12px",
                    fontSize: 12,
                    fontWeight: 500,
                    ...BODY,
                  }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: obs.categoryColour || C.dim }}
                  />
                  {obs.categoryName}
                </span>
              </div>

              {/* Description */}
              {obs.description && (
                <p style={{ ...BODY, color: C.text, fontSize: 14, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
                  {obs.description}
                </p>
              )}

              {/* Info grid */}
              <div
                style={{
                  background: C.bg,
                  border: `1px solid ${C.borderMid}`,
                  borderRadius: "0.625rem",
                  padding: 16,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px 12px",
                }}
              >
                <div>
                  <span style={{ ...HEAD, display: "block", color: C.dim, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Reported By</span>
                  <span style={{ ...BODY, color: C.text, fontSize: 13, fontWeight: 500 }}>{obs.reportedByName}</span>
                </div>
                <div>
                  <span style={{ ...HEAD, display: "block", color: C.dim, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Observed At</span>
                  <span style={{ ...BODY, color: C.text, fontSize: 13, fontWeight: 500 }}>{formatDate(obs.observedAt)}</span>
                </div>
                {obs.namedLocationName && (
                  <div className="col-span-2 flex items-center gap-2" style={{ ...BODY, color: C.emerald, fontSize: 13, fontWeight: 500 }}>
                    <MapPin className="w-4 h-4" /> {obs.namedLocationName}
                  </div>
                )}
                {obs.latitude && obs.longitude && (
                  <div className="col-span-2 flex items-center gap-2" style={{ ...BODY, color: C.muted, fontSize: 12 }}>
                    <Map className="w-4 h-4" /> {obs.latitude.toFixed(6)}, {obs.longitude.toFixed(6)}
                  </div>
                )}
              </div>

              {/* Safety / flag badges */}
              <div className="flex flex-wrap gap-2">
                {obs.safetyIssue && (
                  <span
                    className="flex items-center gap-1.5"
                    style={{
                      background: C.urgentTint,
                      color: C.urgent,
                      border: `1px solid rgba(248,81,73,0.3)`,
                      borderRadius: "9999px",
                      padding: "3px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      ...HEAD,
                    }}
                  >
                    <ShieldAlert className="w-3 h-3" /> Safety Issue
                  </span>
                )}
                {obs.publicAccessAffected && (
                  <span
                    className="flex items-center gap-1.5"
                    style={{
                      background: C.highTint,
                      color: C.high,
                      border: `1px solid rgba(210,153,34,0.3)`,
                      borderRadius: "9999px",
                      padding: "3px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      ...HEAD,
                    }}
                  >
                    <AlertCircle className="w-3 h-3" /> Access Affected
                  </span>
                )}
                {obs.machineryRequired && (
                  <span
                    style={{
                      background: C.borderMid,
                      color: C.muted,
                      borderRadius: "9999px",
                      padding: "3px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      ...HEAD,
                    }}
                  >
                    Machinery Req.
                  </span>
                )}
                {obs.followUpRequired && (
                  <span
                    style={{
                      background: "transparent",
                      border: `1px solid ${C.border}`,
                      color: C.muted,
                      borderRadius: "9999px",
                      padding: "3px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      ...HEAD,
                    }}
                  >
                    Follow-up Req.
                  </span>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Photographs card */}
          <SectionCard>
            <CardHead>
              <Camera className="w-4 h-4" style={{ color: C.muted }} />
              <CardHeadTitle>Photographs</CardHeadTitle>
            </CardHead>
            <div style={{ padding: 16 }} className="space-y-4">
              <PhotoUpload onUploaded={handlePhotoUploaded} label="Add Photo" />
              {imagesLoading ? (
                <div className="flex justify-center items-center py-4 gap-2">
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: C.emerald, animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: C.emerald, animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: C.emerald, animationDelay: "300ms" }} />
                </div>
              ) : (
                <PhotoGallery images={images} onDelete={handleDeleteImage} editable={true} />
              )}
            </div>
          </SectionCard>

          {/* Linked Actions */}
          <div id="linked-actions" className="space-y-3">
            <h2 style={{ ...HEAD, color: C.text, fontSize: 14, fontWeight: 600, margin: 0 }}>
              Linked Actions
            </h2>
            {(!obs.actions || obs.actions.length === 0) ? (
              <div
                className="flex flex-col items-center justify-center"
                style={{
                  background: C.surface,
                  border: `1px dashed ${C.border}`,
                  borderRadius: "0.75rem",
                  padding: 32,
                  textAlign: "center",
                }}
              >
                <p style={{ ...BODY, color: C.muted, fontSize: 13, margin: 0 }}>No actions created for this observation yet.</p>
                <button
                  onClick={() => setLocation(`/actions/new?observationId=${id}`)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: C.emerald,
                    fontSize: 13,
                    marginTop: 8,
                    cursor: "pointer",
                    ...BODY,
                  }}
                >
                  Create the first action →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {obs.actions.map(act => (
                  <Link key={act.id} href={`/actions/${act.id}`}>
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      style={{
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderLeft: `3px solid ${priorityBorderColor(act.priority || 'low')}`,
                        borderRadius: "0.75rem",
                        padding: "12px 16px",
                        transition: "border-color 0.15s",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.muted }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLDivElement
                        el.style.borderColor = C.border
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: "monospace", fontSize: 11, color: C.dim, marginBottom: 3 }}>
                          {act.referenceNumber}
                        </div>
                        <div style={{ ...BODY, color: C.text, fontSize: 14, fontWeight: 500 }}>{act.title}</div>
                        <div className="flex items-center gap-3 mt-1">
                          <span style={{ ...HEAD, color: statusColor(act.status), fontSize: 11, fontWeight: 600 }}>
                            {statusLabel(act.status)}
                          </span>
                          {act.assignedToName && (
                            <span style={{ ...BODY, color: C.dim, fontSize: 12 }}>To: {act.assignedToName}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: C.dim }} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">

          {/* Workflow card */}
          <SectionCard>
            <CardHead>
              <CardHeadTitle>Workflow</CardHeadTitle>
            </CardHead>
            <div style={{ padding: 12 }} className="space-y-2">
              <button
                onClick={() => setStatusOpen(true)}
                className="w-full flex items-center gap-2"
                style={{
                  background: C.borderMid,
                  border: `1px solid ${C.border}`,
                  borderRadius: "0.5rem",
                  color: C.text,
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "8px 12px",
                  cursor: "pointer",
                  ...BODY,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.border }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.borderMid }}
              >
                <CheckCircle2 className="w-4 h-4" style={{ color: C.emerald }} /> Change Status
              </button>
              <button
                onClick={() => setNoteOpen(true)}
                className="w-full flex items-center gap-2"
                style={{
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: "0.5rem",
                  color: C.muted,
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "8px 12px",
                  cursor: "pointer",
                  ...BODY,
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.background = C.borderMid
                  el.style.color = C.text
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement
                  el.style.background = "transparent"
                  el.style.color = C.muted
                }}
              >
                <MessageSquare className="w-4 h-4" /> Add Note
              </button>
            </div>
          </SectionCard>

          {/* Notes card */}
          <SectionCard>
            <CardHead>
              <MessageSquare className="w-4 h-4" style={{ color: C.muted }} />
              <CardHeadTitle>Notes</CardHeadTitle>
            </CardHead>
            <div style={{ padding: 16 }}>
              {(!obs.notes || obs.notes.length === 0) ? (
                <p style={{ ...BODY, color: C.dim, fontSize: 12, textAlign: "center", padding: "16px 0", margin: 0 }}>
                  No notes added.
                </p>
              ) : (
                <div className="space-y-4">
                  {obs.notes.map(note => (
                    <div key={note.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0"
                          style={{ background: C.emeraldDim }}
                        >
                          <span style={{ ...HEAD, fontSize: 10, fontWeight: 700, color: C.emerald }}>
                            {getInitials(note.createdByName ?? '')}
                          </span>
                        </div>
                        <span style={{ ...HEAD, color: C.text, fontSize: 12, fontWeight: 600 }}>{note.createdByName}</span>
                        <span style={{ ...BODY, color: C.dim, fontSize: 11 }}>{formatShortDate(note.createdAt)}</span>
                      </div>
                      <p
                        style={{
                          ...BODY,
                          color: C.muted,
                          fontSize: 13,
                          lineHeight: 1.6,
                          background: C.bg,
                          border: `1px solid ${C.borderMid}`,
                          borderRadius: "0.5rem",
                          padding: "10px 12px",
                          margin: 0,
                        }}
                      >
                        {note.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          {/* History / Audit card */}
          <SectionCard>
            <CardHead>
              <Activity className="w-4 h-4" style={{ color: C.muted }} />
              <CardHeadTitle>History</CardHeadTitle>
            </CardHead>
            <div style={{ padding: 16 }}>
              {(!obs.auditEvents || obs.auditEvents.length === 0) ? (
                <p style={{ ...BODY, color: C.dim, fontSize: 12, textAlign: "center", padding: "16px 0", margin: 0 }}>
                  No history yet.
                </p>
              ) : (
                <div className="relative space-y-4">
                  {/* Vertical line */}
                  <div
                    style={{
                      position: "absolute",
                      left: 6,
                      top: 8,
                      bottom: 8,
                      width: 1,
                      background: C.borderMid,
                    }}
                  />
                  {obs.auditEvents.map(evt => {
                    const evtColor = evt.eventType === 'STATUS_CHANGE' ? statusColor(evt.newValue || '') : C.emerald
                    return (
                      <div key={evt.id} className="relative flex items-start gap-3 pl-5">
                        {/* Dot */}
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 5,
                            width: 13,
                            height: 13,
                            borderRadius: "9999px",
                            background: evtColor,
                            border: `2px solid ${C.bg}`,
                            boxSizing: "border-box",
                          }}
                        />
                        <div>
                          <div style={{ ...BODY, color: C.text, fontSize: 12, fontWeight: 500 }}>
                            {evt.eventType === 'STATUS_CHANGE' ? (
                              <span>
                                Status →{" "}
                                <span
                                  style={{
                                    background: statusBg(evt.newValue || ''),
                                    color: statusColor(evt.newValue || ''),
                                    borderRadius: "9999px",
                                    padding: "1px 6px",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    ...HEAD,
                                  }}
                                >
                                  {statusLabel(evt.newValue || '')}
                                </span>
                              </span>
                            ) : (
                              <span>{evt.eventType.replace(/_/g, ' ')}</span>
                            )}
                          </div>
                          <div style={{ ...BODY, color: C.dim, fontSize: 11, marginTop: 2 }}>
                            {evt.userName} · {formatShortDate(evt.createdAt)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Add Note Dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <DialogHeader>
            <DialogTitle style={{ ...HEAD, color: C.text }}>Add Note</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddNote} className="space-y-4 pt-2">
            <textarea
              placeholder="Type your note here..."
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              onFocus={() => setNoteBodyFocused(true)}
              onBlur={() => setNoteBodyFocused(false)}
              required
              style={{
                ...BODY,
                width: "100%",
                minHeight: 120,
                background: C.bg,
                border: `1px solid ${noteBodyFocused ? C.emerald : C.border}`,
                borderRadius: "0.625rem",
                color: C.text,
                fontSize: 14,
                padding: "10px 12px",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <DialogFooter>
              <button
                type="button"
                onClick={() => setNoteOpen(false)}
                style={{
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: "0.5rem",
                  color: C.muted,
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "7px 16px",
                  cursor: "pointer",
                  ...HEAD,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createNote.isPending || !noteBody.trim()}
                style={{
                  background: createNote.isPending || !noteBody.trim() ? C.emeraldDim : C.emerald,
                  border: "none",
                  borderRadius: "0.5rem",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "7px 16px",
                  cursor: createNote.isPending || !noteBody.trim() ? "not-allowed" : "pointer",
                  opacity: createNote.isPending || !noteBody.trim() ? 0.6 : 1,
                  ...HEAD,
                }}
              >
                {createNote.isPending ? "Adding..." : "Add Note"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Status Dialog */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <DialogHeader>
            <DialogTitle style={{ ...HEAD, color: C.text }}>Change Status</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            {['submitted', 'under_review', 'action_required', 'monitoring', 'resolved', 'closed', 'cancelled'].map(s => {
              const isActive = obs.status === s
              return (
                <button
                  key={s}
                  onClick={() => handleStatusUpdate(s)}
                  disabled={isActive || updateStatus.isPending}
                  style={{
                    background: isActive ? statusBg(s) : C.borderMid,
                    border: `1px solid ${isActive ? statusColor(s) + "4d" : C.border}`,
                    borderRadius: "0.5rem",
                    color: isActive ? statusColor(s) : C.muted,
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    padding: "8px 12px",
                    cursor: isActive || updateStatus.isPending ? "not-allowed" : "pointer",
                    textAlign: "left",
                    ...BODY,
                  }}
                >
                  {statusLabel(s)}
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
