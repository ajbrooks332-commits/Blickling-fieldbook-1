import React from "react"
import { useGetMyActions, useUpdateActionStatus, getGetMyActionsQueryKey } from "@workspace/api-client-react"
import { AlertTriangle, Clock, PlayCircle, CheckCircle2, ArrowUp, ArrowDown, Minus, MapPin } from "lucide-react"
import { Link } from "wouter"
import { formatShortDate } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import { Action } from "@workspace/api-client-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

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
    case 'urgent': return <AlertTriangle className="w-3 h-3" />
    case 'high':   return <ArrowUp className="w-3 h-3" />
    case 'normal': return <Minus className="w-3 h-3" />
    case 'low':    return <ArrowDown className="w-3 h-3" />
    default:       return null
  }
}

export default function MyActions() {
  const { data: myActions, isLoading } = useGetMyActions()
  const updateStatus = useUpdateActionStatus()
  const queryClient = useQueryClient()

  const [completeActionId, setCompleteActionId] = React.useState<number | null>(null)
  const [completionNote, setCompletionNote] = React.useState("")

  if (isLoading || !myActions) {
    return (
      <div className="flex justify-center items-center gap-1 p-12">
        {[0, 150, 300].map(delay => (
          <div key={delay} className="animate-bounce w-2 h-2 rounded-full" style={{ background: C.emerald, animationDelay: `${delay}ms` }} />
        ))}
      </div>
    )
  }

  const handleStatusChange = (id: number, status: 'in_progress' | 'waiting') => {
    updateStatus.mutate(
      { id, data: { status } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetMyActionsQueryKey() }) }
    )
  }

  const handleComplete = (e: React.FormEvent) => {
    e.preventDefault()
    if (!completeActionId) return
    updateStatus.mutate(
      { id: completeActionId, data: { status: 'completed', completionNote } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMyActionsQueryKey() })
          setCompleteActionId(null)
          setCompletionNote("")
        }
      }
    )
  }

  const renderActionList = (actions: Action[], title: string, isOverdue = false) => {
    if (actions.length === 0) return null
    return (
      <div className="space-y-3 mb-8">
        {/* Section heading */}
        <div className="flex items-center gap-2">
          <h3
            style={{
              ...HEAD,
              fontSize: 11,
              fontWeight: 600,
              color: isOverdue ? C.urgent : C.muted,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {title}
          </h3>
          <span
            style={{
              ...HEAD,
              fontSize: 11,
              fontWeight: 600,
              color: isOverdue ? C.urgent : C.dim,
              background: isOverdue ? C.urgentTint : C.borderMid,
              borderRadius: "9999px",
              padding: "1px 8px",
            }}
          >
            {actions.length}
          </span>
        </div>

        <div className="space-y-2">
          {actions.map(action => {
            const pc = priorityConfig(action.priority)
            return (
              <div
                key={action.id}
                style={{
                  background: isOverdue ? `rgba(248,81,73,0.05)` : C.surface,
                  border: `1px solid ${isOverdue ? "rgba(248,81,73,0.25)" : C.border}`,
                  borderLeft: `3px solid ${priorityBorderColor(action.priority)}`,
                  borderRadius: "0.75rem",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "row",
                }}
              >
                {/* Info section */}
                <Link href={`/actions/${action.id}`} className="flex-1">
                  <div
                    className="p-4 cursor-pointer transition-colors h-full"
                    style={{ display: "block" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        style={{
                          ...HEAD,
                          fontSize: 10,
                          color: C.muted,
                          background: C.borderMid,
                          borderRadius: "0.375rem",
                          padding: "1px 6px",
                          fontWeight: 600,
                          letterSpacing: "0.05em",
                        }}
                      >
                        {action.referenceNumber}
                      </span>
                      <span
                        className="flex items-center gap-1"
                        style={{
                          ...HEAD,
                          fontSize: 10,
                          fontWeight: 600,
                          color: pc.color,
                          background: pc.bg,
                          borderRadius: "9999px",
                          padding: "1px 8px",
                        }}
                      >
                        <PriorityIcon p={action.priority} /> {pc.label}
                      </span>
                      <span
                        style={{
                          ...HEAD,
                          fontSize: 10,
                          fontWeight: 600,
                          color: statusColor(action.status),
                          background: statusBg(action.status),
                          borderRadius: "9999px",
                          padding: "1px 8px",
                          marginLeft: "auto",
                        }}
                      >
                        {statusLabel(action.status)}
                      </span>
                    </div>

                    <h4 style={{ ...BODY, fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 6, lineHeight: 1.4 }}>
                      {action.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-3">
                      {action.dueDate && (
                        <span
                          className="flex items-center gap-1"
                          style={{ ...BODY, fontSize: 11, color: isOverdue ? C.urgent : C.muted }}
                        >
                          <Clock className="w-3 h-3" /> {formatShortDate(action.dueDate)}
                          {isOverdue && <span style={{ fontSize: 10, fontWeight: 700 }}> · OVERDUE</span>}
                        </span>
                      )}
                      {action.observationRef && (
                        <Link
                          href={`/observations/${action.observationId}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span
                            className="transition-colors"
                            style={{ ...BODY, fontSize: 11, color: C.emerald, cursor: "pointer" }}
                          >
                            ↗ {action.observationRef}
                          </span>
                        </Link>
                      )}
                      {action.namedLocationName && (
                        <span className="flex items-center gap-1" style={{ ...BODY, fontSize: 11, color: C.muted }}>
                          <MapPin className="w-3 h-3" /> {action.namedLocationName}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Action buttons column */}
                <div
                  className="flex flex-col items-stretch justify-center gap-2 p-3"
                  style={{
                    minWidth: 120,
                    background: C.borderMid,
                    borderLeft: `1px solid ${C.border}`,
                  }}
                >
                  {(action.status === 'not_started' || action.status === 'planned') && (
                    <button
                      onClick={() => handleStatusChange(action.id, 'in_progress')}
                      className="flex items-center gap-1 justify-center transition-colors"
                      style={{
                        ...HEAD,
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.emerald,
                        background: C.emeraldTint,
                        border: `1px solid ${C.emerald}33`,
                        borderRadius: "0.5rem",
                        padding: "6px 10px",
                        cursor: "pointer",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.emeraldDim + "55")}
                      onMouseLeave={e => (e.currentTarget.style.background = C.emeraldTint)}
                    >
                      <PlayCircle className="w-3.5 h-3.5" /> Start
                    </button>
                  )}
                  {action.status === 'in_progress' && (
                    <>
                      <button
                        onClick={() => setCompleteActionId(action.id)}
                        className="flex items-center gap-1 justify-center transition-colors"
                        style={{
                          ...HEAD,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#fff",
                          background: C.emerald,
                          border: "none",
                          borderRadius: "0.5rem",
                          padding: "6px 10px",
                          cursor: "pointer",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = C.emeraldDark)}
                        onMouseLeave={e => (e.currentTarget.style.background = C.emerald)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Done
                      </button>
                      <button
                        onClick={() => handleStatusChange(action.id, 'waiting')}
                        style={{
                          ...BODY,
                          fontSize: 11,
                          color: C.muted,
                          background: "transparent",
                          border: `1px solid ${C.border}`,
                          borderRadius: "0.5rem",
                          padding: "5px 10px",
                          cursor: "pointer",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = C.surface }}
                        onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = "transparent" }}
                      >
                        Pause
                      </button>
                    </>
                  )}
                  {action.status === 'waiting' && (
                    <button
                      onClick={() => handleStatusChange(action.id, 'in_progress')}
                      className="flex items-center gap-1 justify-center transition-colors"
                      style={{
                        ...HEAD,
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.purple,
                        background: C.purple + "1a",
                        border: `1px solid ${C.purple}33`,
                        borderRadius: "0.5rem",
                        padding: "6px 10px",
                        cursor: "pointer",
                      }}
                    >
                      <PlayCircle className="w-3.5 h-3.5" /> Resume
                    </button>
                  )}
                  {action.status === 'completed' && (
                    <span
                      className="flex items-center gap-1 justify-center"
                      style={{
                        ...HEAD,
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.emerald,
                        background: C.emeraldTint,
                        borderRadius: "9999px",
                        padding: "4px 10px",
                      }}
                    >
                      <CheckCircle2 className="w-3 h-3" /> Done
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const allEmpty = !myActions.overdue.length && !myActions.dueToday.length && !myActions.dueThisWeek.length && !myActions.later.length

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ ...HEAD, fontSize: 22, fontWeight: 700, color: C.text }}>My Actions</h1>
          <p style={{ ...BODY, fontSize: 13, color: C.muted, marginTop: 2 }}>Assigned to you</p>
        </div>
        <Link href="/actions/new">
          <button
            style={{
              ...HEAD,
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              background: C.emerald,
              border: "none",
              borderRadius: "0.625rem",
              padding: "8px 16px",
              cursor: "pointer",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = C.emeraldDark)}
            onMouseLeave={e => (e.currentTarget.style.background = C.emerald)}
          >
            Add Action
          </button>
        </Link>
      </div>

      {/* Empty state */}
      {allEmpty && (
        <div
          className="flex flex-col items-center justify-center p-12"
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem", textAlign: "center" }}
        >
          <CheckCircle2 className="w-12 h-12 mb-4" style={{ color: C.dim }} />
          <h3 style={{ ...HEAD, fontSize: 16, fontWeight: 600, color: C.muted }}>All clear!</h3>
          <p style={{ ...BODY, fontSize: 13, color: C.dim, marginTop: 4 }}>No actions currently assigned to you.</p>
        </div>
      )}

      {renderActionList(myActions.overdue, "Overdue", true)}
      {renderActionList(myActions.dueToday, "Due Today")}
      {renderActionList(myActions.dueThisWeek, "Due This Week")}
      {renderActionList(myActions.later, "Later / Unscheduled")}

      {/* Recently completed */}
      {myActions.recentlyCompleted.length > 0 && (
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: `1px solid ${C.borderMid}` }}>
          <h3 style={{ ...HEAD, fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
            Recently Completed
          </h3>
          <div className="space-y-1" style={{ opacity: 0.7 }}>
            {myActions.recentlyCompleted.map(action => (
              <div
                key={action.id}
                className="flex items-center gap-3"
                style={{ padding: "8px", borderRadius: "0.5rem" }}
              >
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: C.emerald }} />
                <span style={{ ...BODY, fontSize: 13, color: C.text, flex: 1 }}>{action.title}</span>
                <span style={{ ...BODY, fontSize: 11, color: C.dim }}>{formatShortDate(action.completedAt)}</span>
                <Link href={`/actions/${action.id}`}>
                  <span style={{ ...BODY, fontSize: 11, color: C.emerald, cursor: "pointer" }}>View</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Complete dialog */}
      <Dialog open={!!completeActionId} onOpenChange={(open) => !open && setCompleteActionId(null)}>
        <DialogContent style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text }}>
          <DialogHeader>
            <DialogTitle style={{ ...HEAD, color: C.text }}>Complete Action</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleComplete} className="space-y-4 pt-2">
            <div className="space-y-2">
              <label style={{ ...BODY, fontSize: 13, color: C.muted }}>Completion note (optional)</label>
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
                placeholder="What was done? Any follow-up needed?"
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                onFocus={e => (e.target.style.borderColor = C.emerald)}
                onBlur={e => (e.target.style.borderColor = C.border)}
              />
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setCompleteActionId(null)}
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
                  color: "#fff",
                  background: updateStatus.isPending ? C.dim : C.emerald,
                  border: "none",
                  borderRadius: "0.625rem",
                  padding: "8px 16px",
                  cursor: "pointer",
                }}
              >
                {updateStatus.isPending ? "Saving…" : "Mark Complete"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
