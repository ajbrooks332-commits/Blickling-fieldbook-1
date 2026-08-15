import React from "react"
import { useListActions } from "@workspace/api-client-react"
import { Search, AlertTriangle, ArrowUp, Minus, ArrowDown, MapPin, Clock, FileText, X, ChevronDown, ChevronRight, User, Printer } from "lucide-react"
import { Link, useSearch } from "wouter"
import { formatShortDate, londonToday } from "@/lib/utils"

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

export default function ActionList() {
  const searchStr = useSearch()
  const urlParams = new URLSearchParams(searchStr)
  const initialOverdue = urlParams.get("overdue") === "true"
  const initialPriority = urlParams.get("priority") || ""

  const [tab, setTab] = React.useState<"open" | "closed">("open")
  const [search, setSearch] = React.useState("")
  const [overdueOnly, setOverdueOnly] = React.useState(initialOverdue)
  const [priorityFilter, setPriorityFilter] = React.useState(initialPriority)
  const [page, setPage] = React.useState(1)
  const [expandedId, setExpandedId] = React.useState<number | null>(null)
  const deferredSearch = React.useDeferredValue(search)

  const { data: listData, isLoading, error: loadError } = useListActions({
    bucket: tab,
    search: deferredSearch,
    ...(overdueOnly && tab === "open" ? { overdue: true } : {}),
    ...(priorityFilter ? { priority: priorityFilter } : {}),
    page, limit: 20,
  })

  // Overdue is a Europe/London calendar-day comparison: a task due today is not overdue.
  const isOverdue = (dueDate: string | null | undefined, status: string) => {
    if (!dueDate || status === "completed" || status === "cancelled") return false
    return dueDate.slice(0, 10) < londonToday()
  }

  const switchTab = (next: "open" | "closed") => {
    setTab(next); setPage(1); setExpandedId(null)
    // The overdue predicate has no meaning for closed records.
    if (next === "closed") setOverdueOnly(false)
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 style={{ ...HEAD, fontSize: 22, fontWeight: 700, color: C.text }}>Actions</h1>
          <p style={{ ...BODY, fontSize: 13, color: C.muted, marginTop: 2 }}>Manage tasks and assignments across the estate</p>
        </div>
        <Link href={`/actions/meeting-pack${(() => {
          const params = new URLSearchParams()
          if (priorityFilter) params.set("priority", priorityFilter)
          if (overdueOnly) params.set("overdue", "true")
          if (deferredSearch) params.set("search", deferredSearch)
          const qs = params.toString()
          return qs ? `?${qs}` : ""
        })()}`}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm shrink-0"
          style={{ border: `1px solid ${C.border}`, color: C.muted, ...HEAD }}>
          <Printer className="w-4 h-4" /> Export open tasks for meeting
        </Link>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Action lists" style={{ display: "flex", gap: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem", padding: 4 }}>
        {([["open", "Open"], ["closed", "Closed"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-controls="action-list-panel"
            onClick={() => switchTab(key)}
            style={{
              flex: 1, padding: "9px 0", borderRadius: "0.5rem", border: "none", cursor: "pointer",
              background: tab === key ? C.emeraldTint : "transparent",
              color: tab === key ? C.emerald : C.muted,
              ...HEAD, fontSize: 13, fontWeight: 700,
              boxShadow: tab === key ? `inset 0 0 0 1px rgba(16,185,129,0.35)` : "none",
              transition: "all 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Active filter chips */}
      {(overdueOnly || priorityFilter) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ ...BODY, fontSize: 12, color: C.muted }}>Filtered by:</span>
          {overdueOnly && (
            <button
              onClick={() => { setOverdueOnly(false); setPage(1) }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: C.urgentTint, color: C.urgent, border: `1px solid ${C.urgent}40`, ...BODY }}
            >
              Overdue only <X className="h-3 w-3" />
            </button>
          )}
          {priorityFilter && (
            <button
              onClick={() => { setPriorityFilter(""); setPage(1) }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: priorityConfig(priorityFilter).bg, color: priorityConfig(priorityFilter).color, border: `1px solid ${priorityConfig(priorityFilter).color}40`, ...BODY }}
            >
              {priorityFilter.charAt(0).toUpperCase() + priorityFilter.slice(1)} priority <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search style={{ color: C.dim }} className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
        <input
          placeholder="Search action ref, title, assignee..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
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

      {/* Loading / error / empty */}
      <div id="action-list-panel" role="tabpanel" aria-label={tab === "open" ? "Open actions" : "Closed actions"} className="space-y-5">
      {loadError ? <div role="alert" className="rounded-md border border-destructive/30 p-4">Actions could not be loaded.</div> : isLoading ? (
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
        <div
          className="flex flex-col items-center justify-center p-12"
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem" }}
        >
          <FileText className="w-10 h-10 mb-3" style={{ color: C.dim }} />
          <p style={{ ...BODY, color: C.muted, fontSize: 14, fontWeight: 500 }}>
            {tab === "open" ? "No open actions" : "No completed actions"}
          </p>
          <p style={{ ...BODY, color: C.dim, fontSize: 12, marginTop: 4 }}>Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {listData?.actions.map(act => {
            const pc = priorityConfig(act.priority)
            const overdue = isOverdue(act.dueDate, act.status)
            const expanded = expandedId === act.id
            return (
              <div
                key={act.id}
                style={{
                  background: overdue ? `rgba(248,81,73,0.04)` : C.surface,
                  border: `1px solid ${expanded ? priorityBorderColor(act.priority) + "60" : C.border}`,
                  borderLeft: `3px solid ${priorityBorderColor(act.priority)}`,
                  borderRadius: "0.75rem",
                  overflow: "hidden",
                  transition: "border-color 0.15s",
                }}
              >
                {/* Compact row: title + status */}
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : act.id)}
                  aria-expanded={expanded}
                  className="w-full text-left"
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", background: "transparent", border: "none", cursor: "pointer" }}
                >
                  {expanded
                    ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: C.dim }} />
                    : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: C.dim }} />}
                  <span className="flex-1 min-w-0 truncate" style={{ ...BODY, color: C.text, fontSize: 14.5, fontWeight: 500 }}>
                    {act.title}
                  </span>
                  {overdue && (
                    <span style={{ ...HEAD, fontSize: 10, fontWeight: 700, color: C.urgent }}>OVERDUE</span>
                  )}
                  <span
                    className="shrink-0"
                    style={{
                      ...HEAD, fontSize: 11, fontWeight: 600,
                      color: statusColor(act.status), background: statusBg(act.status),
                      borderRadius: "9999px", padding: "3px 9px",
                    }}
                  >
                    {statusLabel(act.status)}
                  </span>
                </button>

                {/* Expanded details */}
                {expanded && (
                  <div style={{ borderTop: `1px solid ${C.borderMid}`, padding: "12px 14px 14px 38px" }}>
                    <div className="flex flex-wrap items-center gap-2 mb-2.5">
                      <span style={{ ...HEAD, fontSize: 11, color: C.muted, background: C.borderMid, borderRadius: "0.375rem", padding: "2px 8px", fontWeight: 600, letterSpacing: "0.05em" }}>
                        {act.referenceNumber}
                      </span>
                      <span className="flex items-center gap-1" style={{ ...HEAD, fontSize: 11, fontWeight: 600, color: pc.color, background: pc.bg, borderRadius: "9999px", padding: "2px 8px" }}>
                        <PriorityIcon p={act.priority} /> {pc.label}
                      </span>
                    </div>

                    {act.description && (
                      <p style={{ ...BODY, fontSize: 13, color: C.muted, margin: "0 0 10px", whiteSpace: "pre-wrap" }}>
                        {act.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex items-center gap-1" style={{ ...BODY, fontSize: 12, color: act.assignedToName ? C.muted : C.high }}>
                        <User className="w-3 h-3" /> {act.assignedToName || "Unassigned"}
                      </span>
                      {act.dueDate && (
                        <span className="flex items-center gap-1" style={{ ...BODY, fontSize: 12, color: overdue ? C.urgent : C.muted }}>
                          <Clock className="w-3 h-3" /> Due {formatShortDate(act.dueDate)}
                        </span>
                      )}
                      {act.namedLocationName && (
                        <span className="flex items-center gap-1" style={{ ...BODY, fontSize: 12, color: C.muted }}>
                          <MapPin className="w-3 h-3" /> {act.namedLocationName}
                        </span>
                      )}
                      {act.observationRef && (
                        <Link href={`/observations/${act.observationId}`} onClick={e => e.stopPropagation()}>
                          <span style={{ ...BODY, fontSize: 12, color: C.emerald, cursor: "pointer" }}>↗ {act.observationRef}</span>
                        </Link>
                      )}
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <Link href={`/actions/${act.id}`}>
                        <span
                          style={{
                            display: "inline-block", ...HEAD, fontSize: 12, fontWeight: 700, color: C.emerald,
                            border: `1px solid rgba(16,185,129,0.35)`, borderRadius: "0.5rem", padding: "6px 14px", cursor: "pointer",
                          }}
                        >
                          Open full details
                        </span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {listData && listData.total > listData.limit && <nav aria-label="Action pages" className="flex items-center justify-between border-t pt-4">
        <button type="button" disabled={page === 1 || isLoading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md border px-3 py-2 disabled:opacity-50">Previous</button>
        <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(listData.total / listData.limit)} · {listData.total} records</span>
        <button type="button" disabled={page >= Math.ceil(listData.total / listData.limit) || isLoading} onClick={() => setPage((value) => value + 1)} className="rounded-md border px-3 py-2 disabled:opacity-50">Next</button>
      </nav>}
      </div>
    </div>
  )
}
