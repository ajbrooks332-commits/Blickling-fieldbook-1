import React, { useEffect, useState } from "react"
import { useGetAction, useUpdateActionStatus, useCreateNote, getGetActionQueryKey, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react"
import { useParams, useLocation, Link, useSearch } from "wouter"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertTriangle, ArrowUp, Minus, ArrowDown, MapPin, Clock, ChevronLeft, CheckCircle2, PlayCircle, MessageSquare, FileText, User, Archive, Pencil, Camera } from "lucide-react"
import { formatShortDate, formatDate } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import PhotoGallery from "@/components/PhotoGallery"
import PhotoUpload, { type PhotoUploadResult } from "@/components/PhotoUpload"
import { apiFetch, apiJson } from "@/lib/api"
import { queueNote, queuePhoto, queueStatusUpdate, uploadPhoto } from "@/lib/offline"

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
    case "not_started": return "#8b949e"
    case "planned":     return "#58a6ff"
    case "in_progress": return "#d29922"
    case "waiting":     return "#a78bfa"
    case "completed":   return "#10b981"
    case "cancelled":   return "#484f58"
    default:            return "#8b949e"
  }
}
function statusBg(s: string) { return statusColor(s) + "1a" }
function statusLabel(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) }

const PriorityIcon = ({ p }: { p: string }) => {
  switch (p) {
    case 'urgent': return <AlertTriangle className="w-4 h-4" />
    case 'high':   return <ArrowUp className="w-4 h-4" />
    case 'normal': return <Minus className="w-4 h-4" />
    case 'low':    return <ArrowDown className="w-4 h-4" />
    default:       return null
  }
}

const ALL_STATUSES = [
  { value: "not_started", label: "Not Started" },
  { value: "planned",     label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting",     label: "Waiting" },
  { value: "completed",   label: "Completed" },
  { value: "cancelled",   label: "Cancelled" },
]

const ACTION_TRANSITIONS: Record<string, string[]> = {
  not_started: ["planned", "in_progress", "cancelled"], planned: ["in_progress", "waiting", "cancelled"],
  in_progress: ["waiting", "completed", "cancelled"], waiting: ["in_progress", "cancelled"],
  completed: ["in_progress"], cancelled: ["not_started"],
}

interface ActionImage {
  id: number
  storageKey: string
  originalFilename: string
  caption?: string | null
  mimeType: string
  uploadedByUserId?: number
}

export default function ActionDetail() {
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()

  const { data: act, isLoading, error: loadError } = useGetAction(id, { query: { enabled: !!id, queryKey: getGetActionQueryKey(id) } })
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } })
  const isAdmin = me?.role === "administrator"
  const isManager = me?.role === "administrator" || me?.role === "manager"
  const canUpdate = Boolean(isManager || (me && act?.assignedToUserId === me.id))

  const updateStatus = useUpdateActionStatus()
  const createNote = useCreateNote()

  const [noteOpen, setNoteOpen] = useState(false)
  const [noteBody, setNoteBody] = useState("")
  const [noteSaving, setNoteSaving] = useState(false)

  const [statusOpen, setStatusOpen] = useState(false)
  const [statusNote, setStatusNote] = useState("")
  const [pendingStatus, setPendingStatus] = useState<any>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const searchParams = new URLSearchParams(useSearch())
  const obsStatusUnchanged = searchParams.get("obsStatusUnchanged")
  useEffect(() => {
    if (obsStatusUnchanged) {
      setStatusMessage(`Task created. The linked observation remains in "${obsStatusUnchanged.replace(/_/g, " ")}" — submit it to move it through the workflow.`)
    }
  }, [obsStatusUnchanged])
  const [images, setImages] = useState<ActionImage[]>([])
  const [imagesLoading, setImagesLoading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const fetchImages = async () => {
    if (!id) return
    setImagesLoading(true); setPhotoError(null)
    try { setImages(await apiJson<ActionImage[]>(`/api/actions/${id}/images`)) }
    catch (error) { setPhotoError(error instanceof Error ? error.message : "Photos could not be loaded.") }
    finally { setImagesLoading(false) }
  }

  useEffect(() => { if (id) void fetchImages() }, [id])

  const handlePhotoUploaded = async (image: PhotoUploadResult) => {
    setPhotoError(null)
    if (!me) return setPhotoError("Your session could not be verified. Reload the app and try again.")
    try {
      if (!navigator.onLine) await queuePhoto("actions", id, image, me.id)
      else { await uploadPhoto("actions", id, image); await fetchImages() }
    } catch (error) {
      if (error instanceof TypeError) {
        try { await queuePhoto("actions", id, image, me.id) }
        catch { setPhotoError("The photo could not be saved on this device.") }
      }
      else setPhotoError(error instanceof Error ? error.message : "Photo could not be added.")
    } finally { if (image.previewUrl) URL.revokeObjectURL(image.previewUrl) }
  }

  const handleDeleteImage = async (imageId: number) => {
    setPhotoError(null)
    try {
      const response = await apiFetch(`/api/actions/${id}/images/${imageId}`, { method: "DELETE" })
      if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error ?? "Photo could not be deleted.")
      setImages((current) => current.filter((image) => image.id !== imageId))
    } catch (error) { setPhotoError(error instanceof Error ? error.message : "Photo could not be deleted.") }
  }

  const handleDelete = async () => {
    setDeleting(true); setRequestError(null)
    try {
      const response = await apiFetch(`/api/actions/${id}`, { method: "DELETE" })
      if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error ?? "Action could not be archived.")
      setDeleteOpen(false); setLocation("/actions")
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Action could not be archived.")
    } finally {
      setDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center gap-1 p-12">
        {[0, 150, 300].map(delay => (
          <div key={delay} className="animate-bounce w-2 h-2 rounded-full" style={{ background: C.emeraldBtn, animationDelay: `${delay}ms` }} />
        ))}
      </div>
    )
  }
  if (loadError || !act) return <div role="alert" className="rounded-md border border-destructive/30 p-4">Action could not be loaded.</div>

  const isOverdue = act.dueDate && new Date(act.dueDate) < new Date() && act.status !== 'completed' && act.status !== 'cancelled'
  const pc = priorityConfig(act.priority)
  const canChangeStatus = canUpdate && (!['completed', 'cancelled'].includes(act.status) || Boolean(isManager))

  const submitStatus = async (payload: Record<string, unknown>) => {
    setStatusMessage(null)
    if (!me) { setStatusMessage("Your session could not be verified. Reload the app and try again."); return false }
    const queue = async () => {
      try {
        await queueStatusUpdate("actions", id, payload, me.id)
        setStatusMessage("Status change queued and will sync when the connection returns.")
        return true
      } catch {
        setStatusMessage("The status change could not be saved on this device.")
        return false
      }
    }
    if (!navigator.onLine) return queue()
    try {
      await updateStatus.mutateAsync({ id, data: payload as any })
      await queryClient.invalidateQueries({ queryKey: getGetActionQueryKey(id) })
      return true
    } catch (error) {
      if (error instanceof TypeError) return queue()
      setStatusMessage(error instanceof Error ? error.message : "Status could not be updated.")
      return false
    }
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteBody.trim() || noteSaving) return
    if (!me) return setStatusMessage("Your session could not be verified. Reload the app and try again.")
    setNoteSaving(true); setStatusMessage(null)
    const payload = { body: noteBody.trim(), actionId: id, offlineId: crypto.randomUUID() }
    const queue = async () => {
      try { await queueNote(payload, me.id); setStatusMessage("Note queued and will sync when the connection returns."); return true }
      catch { setStatusMessage("The note could not be saved on this device."); return false }
    }
    let saved = false
    if (!navigator.onLine) saved = await queue()
    else {
      try { await createNote.mutateAsync({ data: payload }); await queryClient.invalidateQueries({ queryKey: getGetActionQueryKey(id) }); saved = true }
      catch (error) { if (error instanceof TypeError) saved = await queue(); else setStatusMessage(error instanceof Error ? error.message : "Note could not be added.") }
    }
    if (saved) { setNoteOpen(false); setNoteBody("") }
    setNoteSaving(false)
  }

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingStatus || !statusNote.trim()) return
    const payload: any = { status: pendingStatus }
    if (pendingStatus === 'completed') payload.completionNote = statusNote
    if (pendingStatus === 'waiting') payload.waitingReason = statusNote
    if (pendingStatus === 'cancelled') payload.cancellationReason = statusNote
    if (await submitStatus(payload)) {
      setStatusOpen(false)
      setPendingStatus(null)
      setStatusNote("")
    }
  }

  const promptStatusChange = async (status: string) => {
    if (!canChangeStatus || !(ACTION_TRANSITIONS[act.status] ?? []).includes(status)) return
    setPendingStatus(status)
    setStatusNote("")
    if (['completed', 'waiting', 'cancelled'].includes(status)) {
      setStatusOpen(true)
    } else {
      await submitStatus({ status })
    }
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-6">
      {statusMessage && <div role="status" className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{statusMessage}</div>}
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 flex-wrap py-3"
        style={{ background: C.bg, borderBottom: `1px solid ${C.borderMid}` }}
      >
        <button
          onClick={() => setLocation("/actions")}
          className="flex items-center gap-1 transition-colors"
          style={{ ...BODY, color: C.muted, fontSize: 13, background: "none", border: "none", cursor: "pointer" }}
          onMouseEnter={e => (e.currentTarget.style.color = C.text)}
          onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
        >
          <ChevronLeft className="w-4 h-4" /> Actions
        </button>
        <span style={{ color: C.dim }}>·</span>
        <span
          style={{
            ...HEAD,
            fontSize: 11,
            color: C.muted,
            background: C.borderMid,
            borderRadius: "0.375rem",
            padding: "2px 8px",
            fontWeight: 600,
            letterSpacing: "0.05em",
          }}
        >
          {act.referenceNumber}
        </span>
        <span
          style={{
            ...HEAD,
            fontSize: 11,
            fontWeight: 600,
            color: statusColor(act.status),
            background: statusBg(act.status),
            borderRadius: "9999px",
            padding: "2px 8px",
          }}
        >
          {statusLabel(act.status)}
        </span>

        {isManager && <button onClick={() => setLocation(`/actions/${id}/edit`)} className="flex items-center gap-1.5 ml-auto"
          style={{ ...BODY, fontSize: 12, color: C.text, background: C.borderMid, border: `1px solid ${C.border}`, borderRadius: "0.5rem", padding: "4px 10px" }}>
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>}
        {isAdmin && (
          <button
            onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-1.5"
            style={{
              ...BODY,
              fontSize: 12,
              fontWeight: 500,
              color: C.urgent,
              background: C.urgentTint,
              border: `1px solid rgba(248,81,73,0.25)`,
              borderRadius: "0.5rem",
              padding: "4px 10px",
              cursor: "pointer",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(248,81,73,0.2)")}
            onMouseLeave={e => (e.currentTarget.style.background = C.urgentTint)}
          >
            <Archive className="w-3.5 h-3.5" /> Archive
          </button>
        )}
      </div>

      {/* Title */}
      <div>
        <h1 style={{ ...HEAD, fontSize: 24, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{act.title}</h1>
        <div className="flex items-center gap-2 mt-2">
          <span
            className="flex items-center gap-1"
            style={{
              ...HEAD,
              fontSize: 12,
              fontWeight: 600,
              color: pc.color,
              background: pc.bg,
              borderRadius: "9999px",
              padding: "2px 10px",
            }}
          >
            <PriorityIcon p={act.priority} /> {pc.label} Priority
          </span>
          {isOverdue && (
            <span style={{ ...HEAD, fontSize: 12, fontWeight: 600, color: C.urgent, background: C.urgentTint, borderRadius: "9999px", padding: "2px 10px" }}>
              OVERDUE
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="md:col-span-2 space-y-5">
          {/* Status update card */}
          {canChangeStatus && <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem", padding: "16px" }}>
            <h2 style={{ ...HEAD, color: C.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              Update Status
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {ALL_STATUSES.filter((item) => item.value === act.status || (ACTION_TRANSITIONS[act.status] ?? []).includes(item.value)).map(s => {
                const active = act.status === s.value
                const sc = statusColor(s.value)
                return (
                  <button
                    key={s.value}
                    onClick={() => promptStatusChange(s.value)}
                    disabled={active}
                    style={{
                      ...HEAD,
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: "0.5rem",
                      padding: "8px 4px",
                      cursor: active ? "default" : "pointer",
                      border: active ? `1px solid ${sc}` : `1px solid ${C.border}`,
                      background: active ? sc + "1a" : "transparent",
                      color: active ? sc : C.muted,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = sc; e.currentTarget.style.color = sc } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted } }}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>}

          {/* Details card */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${priorityBorderColor(act.priority)}`, borderRadius: "0.75rem", padding: "16px" }}>
            <h2 style={{ ...HEAD, color: C.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
              Details
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Due date */}
              {act.dueDate && (
                <div>
                  <span style={{ ...BODY, fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Due Date</span>
                  <span className="flex items-center gap-1" style={{ ...BODY, fontSize: 13, color: isOverdue ? C.urgent : C.text, fontWeight: 500 }}>
                    <Clock className="w-3.5 h-3.5" /> {formatShortDate(act.dueDate)}
                  </span>
                </div>
              )}
              {/* Assigned to */}
              <div>
                <span style={{ ...BODY, fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Assigned To</span>
                {act.assignedToName ? (
                  <span className="flex items-center gap-1" style={{ ...BODY, fontSize: 13, color: C.text, fontWeight: 500 }}>
                    <User className="w-3.5 h-3.5" style={{ color: C.muted }} /> {act.assignedToName}
                  </span>
                ) : (
                  <span style={{ ...BODY, fontSize: 13, color: C.high }}>Unassigned</span>
                )}
              </div>
              {/* Est. time */}
              {act.estimatedMinutes && (
                <div>
                  <span style={{ ...BODY, fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Est. Time</span>
                  <span style={{ ...BODY, fontSize: 13, color: C.text }}>{act.estimatedMinutes} mins</span>
                </div>
              )}
              {/* Location */}
              {act.namedLocationName && (
                <div>
                  <span style={{ ...BODY, fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Location</span>
                  <span className="flex items-center gap-1" style={{ ...BODY, fontSize: 13, color: C.emerald }}>
                    <MapPin className="w-3.5 h-3.5" /> {act.namedLocationName}
                  </span>
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="flex gap-2 flex-wrap">
              {act.equipmentRequired && (
                <span style={{ ...HEAD, fontSize: 11, fontWeight: 600, color: C.muted, background: C.borderMid, borderRadius: "9999px", padding: "2px 10px" }}>Equipment Req.</span>
              )}
              {act.contractorRequired && (
                <span style={{ ...HEAD, fontSize: 11, fontWeight: 600, color: C.purple, background: C.purple + "1a", borderRadius: "9999px", padding: "2px 10px" }}>Contractor Req.</span>
              )}
            </div>

            {/* Linked observation */}
            {act.observationId && (
              <div style={{ borderTop: `1px solid ${C.borderMid}`, marginTop: 16, paddingTop: 16 }}>
                <span style={{ ...BODY, fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Linked Observation</span>
                <Link href={`/observations/${act.observationId}`}>
                  <div
                    className="cursor-pointer transition-all"
                    style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: "0.5rem", padding: "10px 12px" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = C.emerald)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                  >
                    <span style={{ ...HEAD, fontSize: 11, color: C.muted, display: "block", marginBottom: 2 }}>{act.observationRef}</span>
                    <span style={{ ...BODY, fontSize: 13, color: C.emerald, fontWeight: 500 }}>{act.observationTitle}</span>
                  </div>
                </Link>
              </div>
            )}

            {/* Description */}
            {act.description && (
              <div style={{ borderTop: `1px solid ${C.borderMid}`, marginTop: 16, paddingTop: 16 }}>
                <span style={{ ...BODY, fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Description</span>
                <p style={{ ...BODY, fontSize: 13, color: C.muted, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{act.description}</p>
              </div>
            )}

            {/* Completion / waiting notes */}
            {act.status === 'completed' && act.completionNote && (
              <div style={{ marginTop: 16, padding: "12px", background: C.emeraldTint, border: `1px solid ${C.emerald}33`, borderRadius: "0.5rem" }}>
                <span style={{ ...HEAD, fontSize: 12, fontWeight: 600, color: C.emerald, display: "block", marginBottom: 4 }}>Completion Note</span>
                <span style={{ ...BODY, fontSize: 13, color: C.text }}>{act.completionNote}</span>
              </div>
            )}
            {act.status === 'waiting' && act.waitingReason && (
              <div style={{ marginTop: 16, padding: "12px", background: C.highTint, border: `1px solid ${C.high}33`, borderRadius: "0.5rem" }}>
                <span style={{ ...HEAD, fontSize: 12, fontWeight: 600, color: C.high, display: "block", marginBottom: 4 }}>Waiting Reason</span>
                <span style={{ ...BODY, fontSize: 13, color: C.text }}>{act.waitingReason}</span>
              </div>
            )}
          </div>

          {/* Notes card */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem", padding: "16px" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ ...HEAD, color: C.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Notes</h2>
              {canUpdate && act.status !== 'completed' && act.status !== 'cancelled' && (
                <button
                  onClick={() => setNoteOpen(true)}
                  className="flex items-center gap-1 transition-colors"
                  style={{
                    ...BODY,
                    fontSize: 12,
                    color: C.muted,
                    background: "transparent",
                    border: `1px solid ${C.border}`,
                    borderRadius: "0.5rem",
                    padding: "4px 10px",
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.borderMid; e.currentTarget.style.color = C.text }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.muted }}
                >
                  <MessageSquare className="w-3 h-3" /> Add Note
                </button>
              )}
            </div>
            {(!act.notes || act.notes.length === 0) ? (
              <p style={{ ...BODY, color: C.dim, fontSize: 13, textAlign: "center", padding: "16px 0" }}>No notes added yet.</p>
            ) : (
              <div className="space-y-4">
                {act.notes.map(note => (
                  <div key={note.id} className="flex gap-3">
                    {/* Avatar */}
                    <div
                      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: C.emeraldDim, ...HEAD, fontSize: 11, fontWeight: 700, color: C.emerald }}
                    >
                      {(note.createdByName || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span style={{ ...HEAD, fontSize: 12, fontWeight: 600, color: C.text }}>{note.createdByName}</span>
                        <span style={{ ...BODY, fontSize: 11, color: C.dim }}>{formatShortDate(note.createdAt)}</span>
                      </div>
                      <p style={{ ...BODY, fontSize: 13, color: C.muted, background: C.bg, borderRadius: "0.5rem", padding: "8px 12px", lineHeight: 1.5 }}>
                        {note.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Photographs card */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem", padding: "16px" }} className="space-y-4">
            <h2 className="flex items-center gap-2" style={{ ...HEAD, color: C.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              <Camera className="w-4 h-4" /> Photographs
            </h2>
            {canUpdate && <PhotoUpload onUploaded={handlePhotoUploaded} label="Add Progress Photo" deferUpload />}
            {photoError && <p role="alert" className="text-sm text-red-400">{photoError}</p>}
            {imagesLoading ? <p role="status" className="text-sm text-muted-foreground">Loading photos…</p>
              : <PhotoGallery images={images} onDelete={handleDeleteImage} editable={canUpdate}
                  canDelete={(image) => Boolean(isManager || image.uploadedByUserId === me?.id)} />}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Quick actions card */}
          {canChangeStatus && <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem", padding: "16px" }}>
            <h2 style={{ ...HEAD, color: C.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Quick Actions</h2>
            <div className="flex flex-col gap-2">
              {(act.status === 'not_started' || act.status === 'planned' || act.status === 'waiting') && (
                <button
                  onClick={() => promptStatusChange('in_progress')}
                  className="w-full flex items-center gap-2 justify-center transition-colors"
                  style={{ ...HEAD, fontSize: 13, fontWeight: 600, color: "#fff", background: C.emeraldBtn, border: "none", borderRadius: "0.625rem", padding: "10px 16px", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.emeraldDark)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.emerald)}
                >
                  <PlayCircle className="w-4 h-4" /> Start Action
                </button>
              )}
              {act.status === 'in_progress' && (
                <>
                  <button
                    onClick={() => promptStatusChange('completed')}
                    className="w-full flex items-center gap-2 justify-center transition-colors"
                    style={{ ...HEAD, fontSize: 13, fontWeight: 600, color: "#fff", background: C.emeraldBtn, border: "none", borderRadius: "0.625rem", padding: "10px 16px", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.emeraldDark)}
                    onMouseLeave={e => (e.currentTarget.style.background = C.emerald)}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Mark Complete
                  </button>
                  <button
                    onClick={() => promptStatusChange('waiting')}
                    className="w-full flex items-center gap-2 justify-center transition-colors"
                    style={{ ...BODY, fontSize: 13, color: C.muted, background: "transparent", border: `1px solid ${C.border}`, borderRadius: "0.625rem", padding: "10px 16px", cursor: "pointer" }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.borderMid; e.currentTarget.style.color = C.text }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.muted }}
                  >
                    Pause / Wait
                  </button>
                </>
              )}
              {act.status !== 'completed' && act.status !== 'cancelled' && (
                <button
                  onClick={() => promptStatusChange('cancelled')}
                  className="w-full flex items-center gap-2 justify-center transition-colors"
                  style={{
                    ...BODY,
                    fontSize: 13,
                    color: C.urgent,
                    background: C.urgentTint,
                    border: `1px solid rgba(248,81,73,0.3)`,
                    borderRadius: "0.625rem",
                    padding: "10px 16px",
                    cursor: "pointer",
                    marginTop: 4,
                  }}
                >
                  Cancel Action
                </button>
              )}
            </div>
          </div>}

          {/* History card */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem", padding: "16px" }}>
            <h2 style={{ ...HEAD, color: C.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>History</h2>
            {(!act.auditEvents || act.auditEvents.length === 0) ? (
              <p style={{ ...BODY, color: C.dim, fontSize: 12, textAlign: "center", padding: "8px 0" }}>No history yet.</p>
            ) : (
              <div className="space-y-3 relative">
                <div className="absolute left-[5px] top-0 bottom-0 w-px" style={{ background: `linear-gradient(to bottom, transparent, ${C.border}, transparent)` }} />
                {act.auditEvents.map(evt => (
                  <div key={evt.id} className="relative flex items-start gap-3 pl-4">
                    <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full" style={{ background: C.emeraldBtn, border: `2px solid ${C.surface}`, outline: `2px solid ${C.emeraldDim}` }} />
                    <div>
                      <div style={{ ...BODY, fontSize: 12, color: C.text }}>
                        {evt.eventType === 'status_changed' ? (
                          <span>Status → <span style={{ ...HEAD, fontSize: 11, fontWeight: 600, color: statusColor(evt.newValue || ""), background: statusBg(evt.newValue || ""), borderRadius: "9999px", padding: "1px 6px" }}>{statusLabel(evt.newValue || "")}</span></span>
                        ) : (
                          <span style={{ color: C.muted }}>{evt.eventType.replace(/_/g, ' ')}</span>
                        )}
                      </div>
                      <div style={{ ...BODY, fontSize: 11, color: C.dim, marginTop: 2 }}>{evt.userName} · {formatShortDate(evt.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Note Dialog */}
      <Dialog open={noteOpen && canUpdate} onOpenChange={setNoteOpen}>
        <DialogContent style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text }}>
          <DialogHeader>
            <DialogTitle style={{ ...HEAD, color: C.text }}>Add Note</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddNote} className="space-y-4 pt-2">
            <textarea
              style={{
                ...BODY,
                width: "100%",
                background: C.bg,
                border: `1px solid ${C.border}`,
                color: C.text,
                borderRadius: "0.625rem",
                padding: "10px 12px",
                fontSize: 13,
                minHeight: "120px",
                resize: "vertical",
                outline: "none",
              }}
              placeholder="Type your note here..."
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              onFocus={e => (e.target.style.borderColor = C.emerald)}
              onBlur={e => (e.target.style.borderColor = C.border)}
              required
            />
            <DialogFooter>
              <button
                type="button"
                onClick={() => setNoteOpen(false)}
                style={{ ...BODY, fontSize: 13, color: C.muted, background: "transparent", border: `1px solid ${C.border}`, borderRadius: "0.625rem", padding: "8px 16px", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={noteSaving || !noteBody.trim()}
                style={{ ...HEAD, fontSize: 13, fontWeight: 600, color: "#fff", background: noteSaving || !noteBody.trim() ? C.dim : C.emerald, border: "none", borderRadius: "0.625rem", padding: "8px 16px", cursor: "pointer" }}
              >
                {noteSaving ? "Adding…" : "Add Note"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Status update dialog */}
      <Dialog open={statusOpen && canChangeStatus} onOpenChange={(open) => { if (!open) setStatusOpen(false) }}>
        <DialogContent style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text }}>
          <DialogHeader>
            <DialogTitle style={{ ...HEAD, color: C.text }}>
              {pendingStatus === 'completed' ? 'Complete Action' :
               pendingStatus === 'waiting'   ? 'Pause Action' :
               pendingStatus === 'cancelled' ? 'Cancel Action' : 'Update Status'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStatusUpdate} className="space-y-4 pt-2">
            <div className="space-y-2">
              <label style={{ ...BODY, fontSize: 13, color: C.muted }}>
                {pendingStatus === 'completed' ? 'Completion note (required)' :
                 pendingStatus === 'waiting'   ? 'Reason for waiting (required)' :
                 pendingStatus === 'cancelled' ? 'Reason for cancellation (required)' : 'Note'}
              </label>
              <input
                style={{
                  ...BODY,
                  width: "100%",
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                  borderRadius: "0.625rem",
                  padding: "8px 12px",
                  fontSize: 13,
                  outline: "none",
                }}
                value={statusNote}
                onChange={e => setStatusNote(e.target.value)}
                required
                onFocus={e => (e.target.style.borderColor = C.emerald)}
                onBlur={e => (e.target.style.borderColor = C.border)}
              />
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setStatusOpen(false)}
                style={{ ...BODY, fontSize: 13, color: C.muted, background: "transparent", border: `1px solid ${C.border}`, borderRadius: "0.625rem", padding: "8px 16px", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateStatus.isPending || !statusNote.trim()}
                style={{
                  ...HEAD,
                  fontSize: 13,
                  fontWeight: 600,
                  color: pendingStatus === 'cancelled' ? C.urgent : "#fff",
                  background: pendingStatus === 'cancelled' ? C.urgentTint : C.emerald,
                  border: pendingStatus === 'cancelled' ? `1px solid rgba(248,81,73,0.3)` : "none",
                  borderRadius: "0.625rem",
                  padding: "8px 16px",
                  cursor: "pointer",
                }}
              >
                {updateStatus.isPending ? "Saving…" : "Confirm"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem" }}>
          <DialogHeader>
            <DialogTitle style={{ ...HEAD, color: C.text, fontSize: 17 }}>Archive this action?</DialogTitle>
          </DialogHeader>
          <div style={{ padding: "4px 0 8px" }}>
            <p style={{ ...BODY, color: C.muted, fontSize: 14, lineHeight: 1.6 }}>
              <strong style={{ color: C.text }}>{act.referenceNumber}</strong> — <em>{act.title}</em> — will be removed from active views. Notes and audit history will be retained.
            </p>
            {requestError && <p role="alert" className="mt-2 text-sm text-red-400">{requestError}</p>}
          </div>
          <DialogFooter>
            <button
              onClick={() => setDeleteOpen(false)}
              style={{ ...BODY, fontSize: 13, color: C.muted, background: "transparent", border: `1px solid ${C.border}`, borderRadius: "0.625rem", padding: "8px 16px", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{ ...HEAD, fontSize: 13, fontWeight: 600, color: "#fff", background: C.urgent, border: "none", borderRadius: "0.625rem", padding: "8px 16px", cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1 }}
            >
              {deleting ? "Archiving…" : "Archive Action"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
