import React, { useDeferredValue, useState } from "react"
import { useListObservations } from "@workspace/api-client-react"
import { Search, AlertTriangle, ArrowUp, Minus, ArrowDown, MapPin, ShieldAlert, X } from "lucide-react"
import { Link, useSearch } from "wouter"
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

export default function ObservationList() {
  const searchStr = useSearch()
  const urlParams = new URLSearchParams(searchStr)
  const initialPriority = urlParams.get("priority") || ""

  const [search, setSearch] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState(initialPriority)
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const deferredSearch = useDeferredValue(search)

  const { data: listData, isLoading, error: loadError } = useListObservations({
    ...(statusFilter ? { status: statusFilter } : {}),
    search: deferredSearch,
    ...(priorityFilter ? { priority: priorityFilter } : {}),
    page, limit: 20,
  })

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 style={{ ...HEAD, fontSize: 22, fontWeight: 700, color: C.text }}>Observations</h1>
        <p style={{ ...BODY, fontSize: 13, color: C.muted, marginTop: 2 }}>Field records across the estate</p>
      </div>

      {/* Active filter chip */}
      {priorityFilter && (
        <div className="flex items-center gap-2">
          <span style={{ ...BODY, fontSize: 12, color: C.muted }}>Filtered by:</span>
          <button
            onClick={() => { setPriorityFilter(""); setPage(1) }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: priorityConfig(priorityFilter).bg,
              color: priorityConfig(priorityFilter).color,
              border: `1px solid ${priorityConfig(priorityFilter).color}40`,
              ...BODY,
            }}
          >
            {priorityFilter.charAt(0).toUpperCase() + priorityFilter.slice(1)} priority
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: C.dim }}
          />
          <input
            placeholder="Search reference, title, location..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              ...BODY,
              width: "100%",
              background: C.bg,
              border: `1px solid ${searchFocused ? C.emerald : C.border}`,
              borderRadius: "0.625rem",
              color: C.text,
              fontSize: 14,
              padding: "8px 12px 8px 36px",
              outline: "none",
              transition: "border-color 0.15s",
            }}
          />
        </div>
        <label className="sr-only" htmlFor="observation-status">Status</label><select id="observation-status" value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">All statuses</option>{["draft", "submitted", "under_review", "action_required", "monitoring", "resolved", "closed", "cancelled"].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
        </select>
      </div>

      {/* Loading */}
      {loadError ? <div role="alert" className="rounded-md border border-destructive/30 p-4">Observations could not be loaded.</div> : isLoading ? (
        <div className="flex justify-center items-center p-12 gap-2">
          <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: C.emerald, animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: C.emerald, animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: C.emerald, animationDelay: "300ms" }} />
        </div>
      ) : listData?.observations.length === 0 ? (
        /* Empty state */
        <div
          className="flex flex-col items-center justify-center p-12"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: "0.75rem",
          }}
        >
          <Search className="w-10 h-10 mb-3" style={{ color: C.dim }} />
          <p style={{ ...BODY, color: C.muted, fontSize: 14 }}>No observations found.</p>
          <p style={{ ...BODY, color: C.dim, fontSize: 12, marginTop: 4 }}>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {listData?.observations.map(obs => {
            const pc = priorityConfig(obs.priority)
            return (
              <Link key={obs.id} href={`/observations/${obs.id}`}>
                <div
                  className="cursor-pointer"
                  style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderLeft: `3px solid ${priorityBorderColor(obs.priority)}`,
                    borderRadius: "0.75rem",
                    padding: "14px 16px",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.borderColor = C.muted
                    el.style.borderLeftColor = priorityBorderColor(obs.priority)
                    el.style.boxShadow = "0 4px 16px rgba(0,0,0,0.3)"
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.borderColor = C.border
                    el.style.borderLeftColor = priorityBorderColor(obs.priority)
                    el.style.boxShadow = "none"
                  }}
                >
                  <div className="flex flex-col gap-2">
                    {/* Top row: ref + priority + status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Ref number */}
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 11,
                          color: C.muted,
                          background: C.borderMid,
                          borderRadius: "9999px",
                          padding: "2px 8px",
                        }}
                      >
                        {obs.referenceNumber}
                      </span>

                      {/* Priority badge */}
                      <span
                        className="flex items-center gap-1"
                        style={{
                          background: pc.bg,
                          color: pc.color,
                          borderRadius: "9999px",
                          padding: "2px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          ...HEAD,
                        }}
                      >
                        <PriorityIcon p={obs.priority} />
                        {pc.label}
                      </span>

                      {/* Status pill — right side */}
                      <span
                        className="ml-auto"
                        style={{
                          background: statusBg(obs.status),
                          color: statusColor(obs.status),
                          borderRadius: "9999px",
                          padding: "2px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          ...HEAD,
                        }}
                      >
                        {statusLabel(obs.status)}
                      </span>
                    </div>

                    {/* Title row */}
                    <div className="flex items-start gap-2">
                      <h3
                        style={{
                          ...BODY,
                          color: C.text,
                          fontWeight: 500,
                          fontSize: 15,
                          lineHeight: 1.4,
                          flex: 1,
                          margin: 0,
                        }}
                      >
                        {obs.title}
                      </h3>
                      {/* Safety icon */}
                      {obs.safetyIssue && (
                        <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: C.urgent }} />
                      )}
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-3">
                      {obs.categoryName && (
                        <span className="flex items-center gap-1" style={{ ...BODY, color: C.muted, fontSize: 12 }}>
                          <span
                            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: obs.categoryColour || C.dim }}
                          />
                          {obs.categoryName}
                        </span>
                      )}
                      {obs.namedLocationName && (
                        <span className="flex items-center gap-1" style={{ ...BODY, color: C.muted, fontSize: 12 }}>
                          <MapPin className="w-3 h-3" /> {obs.namedLocationName}
                        </span>
                      )}
                      <span style={{ ...BODY, color: C.muted, fontSize: 12 }}>
                        {formatShortDate(obs.observedAt)}
                      </span>

                      {/* Action count chip */}
                      {obs.actionCount ? (
                        <span
                          style={{
                            ...HEAD,
                            background: C.emeraldTint,
                            color: C.emerald,
                            borderRadius: "9999px",
                            padding: "2px 8px",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {obs.actionCount} action{obs.actionCount !== 1 ? "s" : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      {listData && listData.total > listData.limit && <nav aria-label="Observation pages" className="flex items-center justify-between border-t pt-4">
        <button type="button" disabled={page === 1 || isLoading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md border px-3 py-2 disabled:opacity-50">Previous</button>
        <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(listData.total / listData.limit)} · {listData.total} records</span>
        <button type="button" disabled={page >= Math.ceil(listData.total / listData.limit) || isLoading} onClick={() => setPage((value) => value + 1)} className="rounded-md border px-3 py-2 disabled:opacity-50">Next</button>
      </nav>}
    </div>
  )
}
