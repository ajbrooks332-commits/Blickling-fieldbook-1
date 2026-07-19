import React, { useState } from "react"
import { useGetAction, useUpdateActionStatus, useCreateNote, getGetActionQueryKey, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react"
import { useParams, useLocation, Link } from "wouter"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertTriangle, ArrowUp, Minus, ArrowDown, MapPin, Clock, ChevronLeft, CheckCircle2, PlayCircle, MessageSquare, FileText, User, Trash2 } from "lucide-react"
import { formatShortDate, formatDate } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"

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

export default function ActionDetail() {
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()

  const { data: act, isLoading } = useGetAction(id, { query: { enabled: !!id, queryKey: getGetActionQueryKey(id) } })
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } })
  const isAdmin = me?.role === "administrator"

  const updateStatus = useUpdateActionStatus()
  const createNote = useCreateNote()

  const [noteOpen, setNoteOpen] = useState(false)
  const [noteBody, setNoteBody] = useState("")

  const [statusOpen, setStatusOpen] = useState(false)
  const [statusNote, setStatusNote] = useState("")
  const [pendingStatus, setPendingStatus] = useState<any>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/actions/${id}`, { method: "DELETE" })
      if (res.ok) {
        setDeleteOpen(false)
        setLocation("/actions")
      }
    } finally {
      setDeleting(false)
    }
  }

  if (isLoading || !act) {
    return (
      <div className="flex justify-center items-center gap-1 p-12">
        {[0, 150, 300].map(delay => (
          <div key={delay} className="animate-bounce w-2 h-2 rounded-full" style={{ background: C.emerald, animationDelay: `${delay}ms` }} />
        ))}
      </div>
    )
  }

  const isOverdue = act.dueDate && new Date(act.dueDate) < new Date() && act.status !== 'completed' && act.status !== 'cancelled'
  const pc = priorityConfig(act.priority)

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteBody.trim()) return
    createNote.mutate(
      { data: { body: noteBody, actionId: id } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetActionQueryKey(id) })
          setNoteOpen(false)
          setNoteBody("")
        }
      }
    )
  }

  const handleStatusUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingStatus) return
    const payload: any = { status: pendingStatus }
    if (pendingStatus === 'completed') payload.completionNote = statusNote
    if (pendingStatus === 'waiting') payload.waitingReason = statusNote
    if (pendingStatus === 'cancelled') payload.cancellationReason = statusNote
    updateStatus.mutate(
      { id, data: payload },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetActionQueryKey(id) })
          setStatusOpen(false)
          setPendingStatus(null)
          setStatusNote("")
        }
      }
    )
  }

  const promptStatusChange = (status: string) => {
    setPendingStatus(status)
    setStatusNote("")
    if (['completed', 'waiting', 'cancelled'].includes(status)) {
      setStatusOpen(true)
    } else {
      updateStatus.mutate(
        { id, data: { status: status as any } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetActionQueryKey(id) }) }
      )
    }
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-6">
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

        {isAdmin && (
          <button
            onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-1.5 ml-auto"
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
            <Trash2 className="w-3.5 h-3.5" /> Delete
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
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem", padding: "16px" }}>
            <h2 style={{ ...HEAD, color: C.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              Update Status
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {ALL_STATUSES.map(s => {
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
          </div>

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
              {act.status !== 'completed' && act.status !== 'cancelled' && (
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
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Quick actions card */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem", padding: "16px" }}>
            <h2 style={{ ...HEAD, color: C.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Quick Actions</h2>
            <div className="flex flex-col gap-2">
              {(act.status === 'not_started' || act.status === 'planned' || act.status === 'waiting') && (
                <button
                  onClick={() => promptStatusChange('in_progress')}
                  className="w-full flex items-center gap-2 justify-center transition-colors"
                  style={{ ...HEAD, fontSize: 13, fontWeight: 600, color: "#fff", background: C.emerald, border: "none", borderRadius: "0.625rem", padding: "10px 16px", cursor: "pointer" }}
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
                    style={{ ...HEAD, fontSize: 13, fontWeight: 600, color: "#fff", background: C.emerald, border: "none", borderRadius: "0.625rem", padding: "10px 16px", cursor: "pointer" }}
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
          </div>

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
                    <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full" style={{ background: C.emerald, border: `2px solid ${C.surface}`, outline: `2px solid ${C.emeraldDim}` }} />
                    <div>
                      <div style={{ ...BODY, fontSize: 12, color: C.text }}>
                        {evt.eventType === 'STATUS_CHANGE' ? (
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
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
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
                disabled={createNote.isPending || !noteBody.trim()}
                style={{ ...HEAD, fontSize: 13, fontWeight: 600, color: "#fff", background: createNote.isPending || !noteBody.trim() ? C.dim : C.emerald, border: "none", borderRadius: "0.625rem", padding: "8px 16px", cursor: "pointer" }}
              >
                {createNote.isPending ? "Adding…" : "Add Note"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Status update dialog */}
      <Dialog open={statusOpen} onOpenChange={(open) => { if (!open) setStatusOpen(false) }}>
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
                {pendingStatus === 'completed' ? 'Completion note (optional)' :
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
                required={['waiting', 'cancelled'].includes(pendingStatus)}
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
                disabled={updateStatus.isPending}
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

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem" }}>
          <DialogHeader>
            <DialogTitle style={{ ...HEAD, color: C.text, fontSize: 17 }}>Delete this action?</DialogTitle>
          </DialogHeader>
          <div style={{ padding: "4px 0 8px" }}>
            <p style={{ ...BODY, color: C.muted, fontSize: 14, lineHeight: 1.6 }}>
              This will permanently remove <strong style={{ color: C.text }}>{act.referenceNumber}</strong> — <em>{act.title}</em> — along with all its notes and history. This cannot be undone.
            </p>
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
              {deleting ? "Deleting…" : "Delete Action"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
