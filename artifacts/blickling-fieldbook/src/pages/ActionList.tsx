import React from "react"
import { useListActions } from "@workspace/api-client-react"
import { Search, AlertTriangle, ArrowUp, Minus, ArrowDown, MapPin, Clock, FileText } from "lucide-react"
import { Link } from "wouter"
import { formatShortDate } from "@/lib/utils"

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
    case "not_started":     return "#8b949e"
    case "planned":         return "#58a6ff"
    case "in_progress":     return "#d29922"
    case "waiting":         return "#a78bfa"
    case "completed":       return "#10b981"
    default:                return "#8b949e"
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

export default function ActionList() {
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("")
  const { data: listData, isLoading } = useListActions({ status: statusFilter, search })

  const isOverdue = (dueDate: string | null | undefined) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 style={{ ...HEAD, fontSize: 22, fontWeight: 700, color: C.text }}>Actions</h1>
        <p style={{ ...BODY, fontSize: 13, color: C.muted, marginTop: 2 }}>Manage tasks and assignments across the estate</p>
      </div>

      {/* Search + filter bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search style={{ color: C.dim }} className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
          <input
            placeholder="Search action ref, title, assignee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              ...BODY,
              width: "100%",
              background: C.bg,
              border: `1px solid ${C.border}`,
              color: C.text,
              borderRadius: "0.625rem",
              padding: "8px 12px 8px 36px",
              fontSize: 14,
              outline: "none",
            }}
            onFocus={e => (e.target.style.borderColor = C.emerald)}
            onBlur={e => (e.target.style.borderColor = C.border)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            ...BODY,
            background: C.bg,
            border: `1px solid ${C.border}`,
            color: statusFilter ? C.text : C.dim,
            borderRadius: "0.625rem",
            padding: "8px 12px",
            fontSize: 13,
            cursor: "pointer",
            outline: "none",
          }}
          onFocus={e => (e.target.style.borderColor = C.emerald)}
          onBlur={e => (e.target.style.borderColor = C.border)}
        >
          <option value="">All Statuses</option>
          <option value="not_started">Not Started</option>
          <option value="planned">Planned</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting">Waiting</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex justify-center items-center gap-1 p-12">
          {[0, 150, 300].map(delay => (
            <div
              key={delay}
              className="animate-bounce w-2 h-2 rounded-full"
              style={{ background: C.emerald, animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      ) : listData?.actions.length === 0 ? (
        /* Empty state */
        <div
          className="flex flex-col items-center justify-center p-12"
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem" }}
        >
          <FileText className="w-10 h-10 mb-3" style={{ color: C.dim }} />
          <p style={{ ...BODY, color: C.muted, fontSize: 14, fontWeight: 500 }}>No actions found</p>
          <p style={{ ...BODY, color: C.dim, fontSize: 12, marginTop: 4 }}>Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {listData?.actions.map(act => {
            const pc = priorityConfig(act.priority)
            const overdue = isOverdue(act.dueDate)
            return (
              <Link key={act.id} href={`/actions/${act.id}`}>
                <div
                  className="cursor-pointer transition-all"
                  style={{
                    background: overdue ? `rgba(248,81,73,0.04)` : C.surface,
                    border: `1px solid ${C.border}`,
                    borderLeft: `3px solid ${priorityBorderColor(act.priority)}`,
                    borderRadius: "0.75rem",
                    padding: "16px",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = `${priorityBorderColor(act.priority)}`)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                >
                  {/* Top row: ref, priority, status */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
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
                    {/* Priority pill */}
                    <span
                      className="flex items-center gap-1"
                      style={{
                        ...HEAD,
                        fontSize: 11,
                        fontWeight: 600,
                        color: pc.color,
                        background: pc.bg,
                        borderRadius: "9999px",
                        padding: "2px 8px",
                      }}
                    >
                      <PriorityIcon p={act.priority} />
                      {pc.label}
                    </span>
                    {/* Status pill */}
                    <span
                      style={{
                        ...HEAD,
                        fontSize: 11,
                        fontWeight: 600,
                        color: statusColor(act.status),
                        background: statusBg(act.status),
                        borderRadius: "9999px",
                        padding: "2px 8px",
                        marginLeft: "auto",
                      }}
                    >
                      {statusLabel(act.status)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 style={{ ...BODY, color: C.text, fontSize: 15, fontWeight: 500, marginBottom: 8 }}>
                    {act.title}
                  </h3>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-3">
                    {act.assignedToName ? (
                      <span style={{ ...BODY, fontSize: 12, color: C.muted, background: C.borderMid, borderRadius: "0.375rem", padding: "2px 8px" }}>
                        {act.assignedToName}
                      </span>
                    ) : (
                      <span style={{ ...BODY, fontSize: 12, color: C.high, background: C.highTint, borderRadius: "0.375rem", padding: "2px 8px" }}>
                        Unassigned
                      </span>
                    )}

                    {act.dueDate && (
                      <span className="flex items-center gap-1" style={{ ...BODY, fontSize: 12, color: overdue ? C.urgent : C.muted }}>
                        <Clock className="w-3 h-3" /> Due {formatShortDate(act.dueDate)}
                        {overdue && <span style={{ fontSize: 10, fontWeight: 700, color: C.urgent }}> · OVERDUE</span>}
                      </span>
                    )}

                    {act.namedLocationName && (
                      <span className="flex items-center gap-1" style={{ ...BODY, fontSize: 12, color: C.muted }}>
                        <MapPin className="w-3 h-3" /> {act.namedLocationName}
                      </span>
                    )}

                    {act.observationRef && (
                      <span style={{ ...BODY, fontSize: 12, color: C.emerald }}>
                        ↗ {act.observationRef}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
