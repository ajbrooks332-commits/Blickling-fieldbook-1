import React, { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  useCreateActivity, useCreateActivityType, useCreateLocation, useDeleteActivity, useGetActivityReport,
  useGetMe, useListActivities, useListActivityTypes, useListAssignees, useListLocations,
  getListActivitiesQueryKey, getListActivityTypesQueryKey, getListLocationsQueryKey, getGetActivityReportQueryKey,
} from "@workspace/api-client-react"
import { BarChart3, Check, Clock, Download, Loader2, MapPin, PencilLine, Plus, Trash2, Users } from "lucide-react"
import { queueActivity } from "@/lib/offline"

const C = {
  bg: "#0d1117",
  surface: "#161b22",
  border: "#30363d",
  text: "#e6edf3",
  muted: "#8b949e",
  dim: "#7d8590",
  emerald: "#10b981", emeraldBtn: "#047857",
  emeraldTint: "rgba(16,185,129,0.08)",
  blue: "#58a6ff",
  blueTint: "rgba(88,166,255,0.12)",
}

const HEAD = { fontFamily: "'Space Grotesk', sans-serif" }
const BODY = { fontFamily: "'Inter', sans-serif" }

const labelStyle: React.CSSProperties = {
  ...HEAD, fontSize: 13, fontWeight: 600, color: C.muted, display: "block", marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  background: C.bg, border: `1px solid ${C.border}`, color: C.text,
  borderRadius: "0.625rem", padding: "0.5rem 0.75rem", fontSize: 14, outline: "none", ...BODY,
}

const DURATIONS = [
  { label: "30m", minutes: 30 }, { label: "1h", minutes: 60 }, { label: "1.5h", minutes: 90 },
  { label: "2h", minutes: 120 }, { label: "2.5h", minutes: 150 }, { label: "3h", minutes: 180 },
  { label: "4h", minutes: 240 }, { label: "6h", minutes: 360 }, { label: "8h", minutes: 480 },
]

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function isoFor(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60), m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function formatHours(minutes: number) {
  return (minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)
}

function formatDate(iso: string) {
  const today = todayISO()
  if (iso === today) return "Today"
  const y = new Date(); y.setDate(y.getDate() - 1)
  if (iso === isoFor(y)) return "Yesterday"
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 12px",
        background: selected ? C.emeraldTint : "transparent",
        border: `1px solid ${selected ? C.emerald : C.border}`,
        borderRadius: "0.625rem",
        cursor: "pointer",
        transition: "all 0.15s",
        ...HEAD,
        fontSize: 13,
        fontWeight: 600,
        color: selected ? C.emerald : C.muted,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {selected && <Check size={13} color={C.emerald} />}
      {children}
    </button>
  )
}

/* ---------- Report tab ---------- */

const RANGES = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
] as const

function rangeDates(key: string): { from?: string; to?: string } {
  const now = new Date()
  if (key === "week") {
    const d = new Date(now)
    const day = (d.getDay() + 6) % 7 // Monday = 0
    d.setDate(d.getDate() - day)
    return { from: isoFor(d) }
  }
  if (key === "month") return { from: isoFor(new Date(now.getFullYear(), now.getMonth(), 1)) }
  if (key === "year") return { from: `${now.getFullYear()}-01-01` }
  return {}
}

function BarRow({ label, sub, minutes, max, colour }: { label: string; sub?: string; minutes: number; max: number; colour: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((minutes / max) * 100)) : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3, gap: 8 }}>
        <span style={{ ...HEAD, fontSize: 13, fontWeight: 600, color: C.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}{sub && <span style={{ color: C.dim, fontWeight: 500, marginLeft: 6, fontSize: 12 }}>{sub}</span>}
        </span>
        <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{formatHours(minutes)}h</span>
      </div>
      <div style={{ height: 8, background: C.bg, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: colour, borderRadius: 999, transition: "width 0.3s" }} />
      </div>
    </div>
  )
}

function ReportTab() {
  const [range, setRange] = useState<string>("month")
  const { from, to } = rangeDates(range)
  const params = { ...(from ? { from } : {}), ...(to ? { to } : {}) }
  const { data: report, isLoading } = useGetActivityReport(params, {
    query: { queryKey: getGetActivityReportQueryKey(params) },
  })

  const downloadCsv = () => {
    if (!report) return
    // Quote, and neutralise formula-leading characters so spreadsheets don't execute cells.
    const esc = (v: string | number) => {
      let s = String(v)
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
      return `"${s.replace(/"/g, '""')}"`
    }
    const labourCols = (r: { minutes: number; count: number; staffPersonMinutes: number; volunteerPersonMinutes: number; contractorRecordedMinutes: number; contractorUnknownCount: number }) => [
      r.count, (r.minutes / 60).toFixed(2), (r.staffPersonMinutes / 60).toFixed(2),
      (r.volunteerPersonMinutes / 60).toFixed(2), (r.contractorRecordedMinutes / 60).toFixed(2),
      r.contractorUnknownCount > 0 ? esc(`${r.contractorUnknownCount} unknown`) : "0",
    ]
    const header = ["Entries", "Elapsed hours", "Staff person-hours", "Volunteer person-hours", "Contractor person-hours (recorded)", "Contractor hours unknown"]
    const lines = [
      ["Activity", "Category", ...header].join(","),
      ...report.byType.map(r => [esc(r.name), esc(r.category), ...labourCols(r)].join(",")),
      "",
      ["Category", "", ...header].join(","),
      ...report.byCategory.map(r => [esc(r.category), "", ...labourCols(r)].join(",")),
      "",
      [esc("Total"), "", report.totalCount, (report.totalMinutes / 60).toFixed(2), (report.totalStaffPersonMinutes / 60).toFixed(2),
        (report.totalVolunteerPersonMinutes / 60).toFixed(2), (report.totalContractorRecordedMinutes / 60).toFixed(2),
        report.contractorUnknownCount > 0 ? esc(`${report.contractorUnknownCount} unknown`) : "0"].join(","),
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `activity-report-${range}-${todayISO()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const maxType = Math.max(0, ...(report?.byType ?? []).map(r => r.minutes))
  const maxCat = Math.max(0, ...(report?.byCategory ?? []).map(r => r.minutes))

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center" }}>
        {RANGES.map(r => (
          <Chip key={r.key} selected={range === r.key} onClick={() => setRange(r.key)}>{r.label}</Chip>
        ))}
        <button
          type="button" onClick={downloadCsv} disabled={!report || report.byType.length === 0}
          style={{
            marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 12px", background: "transparent", border: `1px solid ${C.border}`,
            borderRadius: "0.625rem", cursor: report && report.byType.length > 0 ? "pointer" : "not-allowed",
            ...HEAD, fontSize: 13, fontWeight: 600, color: report && report.byType.length > 0 ? C.blue : C.dim,
          }}
        >
          <Download size={13} />Export CSV
        </button>
      </div>

      {isLoading && <div style={{ color: C.muted, fontSize: 14 }}><Loader2 size={14} className="animate-spin" style={{ verticalAlign: "-2px", marginRight: 6 }} />Loading…</div>}

      {report && report.byType.length === 0 && !isLoading && (
        <div style={{ color: C.dim, fontSize: 14, textAlign: "center", padding: "32px 0" }}>No activity recorded in this period.</div>
      )}

      {report && report.byType.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 130, background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem", padding: "12px 14px" }}>
              <div style={{ ...HEAD, fontSize: 22, fontWeight: 700, color: C.emerald }}>{formatHours(report.totalMinutes)}h</div>
              <div style={{ fontSize: 12, color: C.muted }}>Elapsed hours</div>
            </div>
            <div style={{ flex: 1, minWidth: 130, background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem", padding: "12px 14px" }}>
              <div style={{ ...HEAD, fontSize: 22, fontWeight: 700, color: C.blue }}>{formatHours(report.totalStaffPersonMinutes)}h</div>
              <div style={{ fontSize: 12, color: C.muted }}>Staff person-hours</div>
            </div>
            <div style={{ flex: 1, minWidth: 130, background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem", padding: "12px 14px" }}>
              <div style={{ ...HEAD, fontSize: 22, fontWeight: 700, color: C.text }}>{formatHours(report.totalVolunteerPersonMinutes)}h</div>
              <div style={{ fontSize: 12, color: C.muted }}>Volunteer person-hours</div>
            </div>
            <div style={{ flex: 1, minWidth: 130, background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem", padding: "12px 14px" }}>
              <div style={{ ...HEAD, fontSize: 22, fontWeight: 700, color: C.text }}>{report.totalCount}</div>
              <div style={{ fontSize: 12, color: C.muted }}>Entries</div>
            </div>
          </div>
          {(report.contractorUnknownCount > 0 || report.totalContractorRecordedMinutes > 0) && (
            <p style={{ fontSize: 12, color: C.muted, margin: "0 0 16px" }}>
              Contractor person-hours (recorded): {formatHours(report.totalContractorRecordedMinutes)}h
              {report.contractorUnknownCount > 0 && ` · ${report.contractorUnknownCount} ${report.contractorUnknownCount === 1 ? "entry" : "entries"} with contractor hours unknown`}
            </p>
          )}
          {report.unattributedCount > 0 && (
            <p style={{ fontSize: 12, color: C.dim, margin: "0 0 16px" }}>
              {report.unattributedCount} {report.unattributedCount === 1 ? "entry has" : "entries have"} elapsed time only — no person-hours attributed.
            </p>
          )}

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.875rem", padding: 16, marginBottom: 16 }}>
            <h3 style={{ ...HEAD, fontSize: 14, fontWeight: 700, color: C.text, margin: "0 0 12px" }}>Elapsed hours by category</h3>
            {report.byCategory.map(r => (
              <BarRow key={r.category} label={r.category} sub={`${r.count} ${r.count === 1 ? "entry" : "entries"}`} minutes={r.minutes} max={maxCat} colour={C.blue} />
            ))}
          </div>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.875rem", padding: 16 }}>
            <h3 style={{ ...HEAD, fontSize: 14, fontWeight: 700, color: C.text, margin: "0 0 12px" }}>Elapsed hours by activity</h3>
            {report.byType.map(r => (
              <BarRow key={r.activityTypeId} label={r.name} sub={r.category} minutes={r.minutes} max={maxType} colour={C.emerald} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------- Log tab ---------- */

export default function Activities() {
  const { data: me } = useGetMe()
  const { data: types } = useListActivityTypes()
  const { data: locations } = useListLocations()
  const { data: assignees } = useListAssignees()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<"log" | "report">("log")

  const [typeId, setTypeId] = useState<number | null>(null)
  const [locationIds, setLocationIds] = useState<number[]>([])
  const [participants, setParticipants] = useState<number[]>([])
  const [volunteerCount, setVolunteerCount] = useState("")
  const [contractorChoice, setContractorChoice] = useState<"none" | "recorded" | "unknown">("none")
  const [contractorHours, setContractorHours] = useState("")
  const [noStaffReason, setNoStaffReason] = useState<"" | "elapsed_only" | "other_unknown">("")
  const [duration, setDuration] = useState<number | null>(null)
  const [customDuration, setCustomDuration] = useState(false)
  const [customHours, setCustomHours] = useState("")
  const [activityDate, setActivityDate] = useState(todayISO())
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [addingType, setAddingType] = useState(false)
  const [newTypeName, setNewTypeName] = useState("")
  const [addingLocation, setAddingLocation] = useState(false)
  const [newLocationName, setNewLocationName] = useState("")

  const { data: list, isLoading: listLoading } = useListActivities({ limit: 100 })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() })
    queryClient.invalidateQueries({ queryKey: getGetActivityReportQueryKey() })
  }
  const createActivity = useCreateActivity({ mutation: { onSuccess: () => {
    invalidate()
    setTypeId(null); setLocationIds([]); setParticipants([]); setDuration(null)
    setCustomDuration(false); setCustomHours(""); setNotes(""); setError(null)
    setVolunteerCount(""); setContractorChoice("none"); setContractorHours(""); setNoStaffReason("")
    setSaved(true); window.setTimeout(() => setSaved(false), 2500)
  }, onError: () => setError("Could not save the activity. Please try again.") } })
  const deleteActivity = useDeleteActivity({ mutation: { onSuccess: invalidate } })
  const createType = useCreateActivityType({ mutation: {
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: getListActivityTypesQueryKey() })
      setTypeId(row.id)
      setAddingType(false)
      setNewTypeName("")
    },
    onError: () => setError("Could not add that activity — please try again."),
  } })
  const createLocation = useCreateLocation({ mutation: {
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() })
      setLocationIds(ids => ids.includes(row.id) ? ids : [...ids, row.id])
      setAddingLocation(false)
      setNewLocationName("")
    },
    onError: () => setError("Could not add that location — please try again."),
  } })

  const activeLocations = useMemo(() => (locations ?? []).filter(l => l.active), [locations])

  const effectiveDuration = customDuration
    ? Math.round(Number(customHours || "0") * 60)
    : duration

  const canSave = typeId != null && effectiveDuration != null && effectiveDuration >= 5 && effectiveDuration <= 1440

  const submitNewType = () => {
    const name = newTypeName.trim()
    if (!name) return
    createType.mutate({ data: { name } })
  }

  const submitNewLocation = () => {
    const name = newLocationName.trim()
    if (!name) return
    createLocation.mutate({ data: { name } })
  }

  const volunteers = volunteerCount.trim() === "" ? null : Number(volunteerCount)
  const contractorMinutes = contractorChoice === "recorded" && contractorHours.trim() !== ""
    ? Math.round(Number(contractorHours) * 60) : null
  // With no staff selected and no volunteer/contractor labour, the recorder
  // must say explicitly how the hours should be counted.
  const needsHoursChoice = participants.length === 0 && volunteers == null
    && contractorChoice === "none"

  const submit = () => {
    if (!canSave) {
      setError(typeId == null ? "Pick an activity first" : "Pick how long it took")
      return
    }
    if (needsHoursChoice && !noStaffReason) {
      setError("No one was selected — choose how these hours should be counted.")
      return
    }
    if (contractorChoice === "recorded" && contractorMinutes == null) {
      setError("Enter the contractor hours, or mark them as unknown.")
      return
    }
    setError(null)
    const payload = {
      activityTypeId: typeId!,
      namedLocationIds: locationIds,
      activityDate,
      durationMinutes: effectiveDuration!,
      participantUserIds: participants,
      ...(volunteers != null ? { volunteerCount: volunteers } : {}),
      ...(contractorMinutes != null ? { contractorMinutes } : {}),
      contractorHoursUnknown: contractorChoice === "unknown",
      ...(participants.length === 0 ? { hoursStatus: (noStaffReason || (contractorChoice === "unknown" ? "contractor_unknown" : "elapsed_only")) as "elapsed_only" | "contractor_unknown" | "other_unknown" } : {}),
      notes: notes.trim() ? notes.trim() : null,
    }
    if (!navigator.onLine && me) {
      // Queue for later sync instead of failing.
      void queueActivity({ ...payload, offlineId: crypto.randomUUID() }, me.id).then(() => {
        setTypeId(null); setLocationIds([]); setParticipants([]); setDuration(null)
        setCustomDuration(false); setCustomHours(""); setNotes(""); setError(null)
        setVolunteerCount(""); setContractorChoice("none"); setContractorHours(""); setNoStaffReason("")
        setSaved(true); window.setTimeout(() => setSaved(false), 2500)
      }).catch(() => setError("Could not save the activity offline."))
      return
    }
    createActivity.mutate({ data: payload })
  }

  const grouped = useMemo(() => {
    const map = new Map<string, NonNullable<typeof list>["activities"]>()
    for (const a of list?.activities ?? []) {
      const arr = map.get(a.activityDate) ?? []
      arr.push(a)
      map.set(a.activityDate, arr)
    }
    return [...map.entries()]
  }, [list])

  const canDelete = (recordedByUserId: number) =>
    me?.role === "administrator" || me?.role === "manager" || me?.id === recordedByUserId

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 16px 96px", ...BODY }}>
      <div style={{ marginBottom: 18, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ ...HEAD, fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Daily Activities</h1>
          <p style={{ color: C.muted, fontSize: 13, margin: "4px 0 0" }}>
            {tab === "log" ? "Tap to record what you did today." : "Hours by activity and category."}
          </p>
        </div>
        <div style={{ display: "inline-flex", background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.625rem", padding: 3, gap: 2 }}>
          {([["log", "Log", Plus], ["report", "Report", BarChart3]] as const).map(([key, label, Icon]) => (
            <button
              key={key} type="button" onClick={() => setTab(key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px",
                background: tab === key ? C.blueTint : "transparent", border: "none",
                borderRadius: "0.5rem", cursor: "pointer", ...HEAD, fontSize: 13, fontWeight: 600,
                color: tab === key ? C.blue : C.muted,
              }}
            >
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
      </div>

      {tab === "report" && <ReportTab />}

      {tab === "log" && (
      <>
      {/* Quick add card */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.875rem", padding: 16, marginBottom: 24 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>What did you do?</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(types ?? []).map(t => (
              <Chip key={t.id} selected={typeId === t.id} onClick={() => setTypeId(typeId === t.id ? null : t.id)}>{t.name}</Chip>
            ))}
            <Chip selected={addingType} onClick={() => { setAddingType(!addingType); setNewTypeName("") }}>
              <PencilLine size={13} />Something else…
            </Chip>
          </div>
          {addingType && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <input
                type="text" placeholder="Type the activity, e.g. Pond clearing" value={newTypeName} maxLength={200}
                autoFocus
                onChange={e => setNewTypeName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submitNewType() }}
                style={{ ...inputStyle, flex: 1, minWidth: 200 }}
              />
              <button
                type="button" onClick={submitNewType} disabled={!newTypeName.trim() || createType.isPending}
                style={{
                  padding: "8px 14px", background: newTypeName.trim() ? C.emerald : C.border, border: "none",
                  borderRadius: "0.625rem", cursor: newTypeName.trim() ? "pointer" : "not-allowed",
                  ...HEAD, fontSize: 13, fontWeight: 700, color: newTypeName.trim() ? "#04150e" : C.dim,
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                {createType.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}Add
              </button>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}><MapPin size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Where? <span style={{ fontWeight: 400, color: C.dim }}>(pick as many as apply)</span></label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {activeLocations.map(l => (
              <Chip
                key={l.id}
                selected={locationIds.includes(l.id)}
                onClick={() => setLocationIds(ids => ids.includes(l.id) ? ids.filter(id => id !== l.id) : [...ids, l.id])}
              >
                {l.name}
              </Chip>
            ))}
            <Chip selected={addingLocation} onClick={() => { setAddingLocation(!addingLocation); setNewLocationName("") }}>
              <PencilLine size={13} />Somewhere else…
            </Chip>
          </div>
          {addingLocation && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <input
                type="text" placeholder="Type the location, e.g. Woodgate" value={newLocationName} maxLength={200}
                autoFocus
                onChange={e => setNewLocationName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submitNewLocation() }}
                style={{ ...inputStyle, flex: 1, minWidth: 200 }}
              />
              <button
                type="button" onClick={submitNewLocation} disabled={!newLocationName.trim() || createLocation.isPending}
                style={{
                  padding: "8px 14px", background: newLocationName.trim() ? C.emerald : C.border, border: "none",
                  borderRadius: "0.625rem", cursor: newLocationName.trim() ? "pointer" : "not-allowed",
                  ...HEAD, fontSize: 13, fontWeight: 700, color: newLocationName.trim() ? "#04150e" : C.dim,
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                {createLocation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}Add
              </button>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}><Users size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Who was involved?</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(assignees ?? []).map(u => (
              <Chip
                key={u.id}
                selected={participants.includes(u.id)}
                onClick={() => setParticipants(p => p.includes(u.id) ? p.filter(id => id !== u.id) : [...p, u.id])}
              >
                {u.name}{me?.id === u.id ? " (me)" : ""}
              </Chip>
            ))}
          </div>
          <p style={{ fontSize: 11, color: C.dim, margin: "6px 0 0" }}>
            Staff person-hours = duration × selected people. You are not counted unless you select yourself.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Volunteers (optional)</label>
            <input
              type="number" inputMode="numeric" min={0} max={500} placeholder="How many?"
              value={volunteerCount} onChange={e => setVolunteerCount(e.target.value)}
              style={{ ...inputStyle, width: 120 }}
            />
          </div>
          <div>
            <label style={labelStyle}>Contractor</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Chip selected={contractorChoice === "none"} onClick={() => setContractorChoice("none")}>None</Chip>
              <Chip selected={contractorChoice === "recorded"} onClick={() => setContractorChoice("recorded")}>Hours known</Chip>
              <Chip selected={contractorChoice === "unknown"} onClick={() => setContractorChoice("unknown")}>Hours unknown</Chip>
            </div>
            {contractorChoice === "recorded" && (
              <input
                type="number" inputMode="decimal" min={0} step={0.25} placeholder="Contractor hours"
                value={contractorHours} onChange={e => setContractorHours(e.target.value)}
                style={{ ...inputStyle, marginTop: 8, width: 160 }}
              />
            )}
          </div>
        </div>

        {needsHoursChoice && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Hours status — how should these hours be counted?</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Chip selected={noStaffReason === "elapsed_only"} onClick={() => setNoStaffReason(noStaffReason === "elapsed_only" ? "" : "elapsed_only")}>Elapsed time only</Chip>
              <Chip selected={noStaffReason === "other_unknown"} onClick={() => setNoStaffReason(noStaffReason === "other_unknown" ? "" : "other_unknown")}>Labour unknown</Chip>
            </div>
            <p style={{ fontSize: 11, color: C.dim, margin: "6px 0 0" }}>
              No participants selected — these hours will not be counted as person-hours.
            </p>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}><Clock size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />How long?</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {DURATIONS.map(d => (
              <Chip key={d.minutes} selected={!customDuration && duration === d.minutes}
                onClick={() => { setCustomDuration(false); setDuration(duration === d.minutes && !customDuration ? null : d.minutes) }}>
                {d.label}
              </Chip>
            ))}
            <Chip selected={customDuration} onClick={() => { setCustomDuration(!customDuration); setDuration(null) }}>Other…</Chip>
          </div>
          {customDuration && (
            <input
              type="number" inputMode="decimal" min={0.1} max={24} step={0.25}
              placeholder="Hours, e.g. 2.5"
              value={customHours}
              onChange={e => setCustomHours(e.target.value)}
              style={{ ...inputStyle, marginTop: 10, padding: "0.625rem 0.75rem", width: 160 }}
            />
          )}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date" aria-label="Activity date" value={activityDate} max={todayISO()}
              onChange={e => setActivityDate(e.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Note (optional)</label>
            <input
              type="text" placeholder="Anything worth adding…" value={notes} maxLength={2000}
              onChange={e => setNotes(e.target.value)}
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
            />
          </div>
        </div>

        {error && <div style={{ color: "#f85149", fontSize: 13, marginBottom: 10 }}>{error}</div>}
        {saved && <div style={{ color: C.emerald, fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Check size={14} />Activity recorded</div>}

        <button
          type="button" onClick={submit} disabled={createActivity.isPending}
          style={{
            width: "100%", padding: "12px", background: canSave ? C.emerald : C.border, border: "none",
            borderRadius: "0.625rem", cursor: canSave ? "pointer" : "not-allowed", ...HEAD,
            fontSize: 15, fontWeight: 700, color: canSave ? "#04150e" : "#a3adb8",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {createActivity.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Record activity
        </button>
      </div>

      {/* Recent entries */}
      <h2 style={{ ...HEAD, fontSize: 16, fontWeight: 700, color: C.text, margin: "0 0 12px" }}>Recent activity</h2>
      {listLoading && <div style={{ color: C.muted, fontSize: 14 }}><Loader2 size={14} className="animate-spin" style={{ verticalAlign: "-2px", marginRight: 6 }} />Loading…</div>}
      {!listLoading && grouped.length === 0 && (
        <div style={{ color: C.dim, fontSize: 14, textAlign: "center", padding: "32px 0" }}>Nothing recorded yet. Your team's activity will appear here.</div>
      )}
      {grouped.map(([date, entries]) => (
        <div key={date} style={{ marginBottom: 20 }}>
          <div style={{ ...HEAD, fontSize: 12, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            {formatDate(date)} · {formatDuration(entries.reduce((s, e) => s + e.durationMinutes, 0))} total
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entries.map(a => (
              <div key={a.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.75rem", padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ ...HEAD, fontSize: 14, fontWeight: 700, color: C.text }}>{a.activityTypeName}</span>
                    <span style={{ background: C.emeraldTint, color: C.emerald, borderRadius: 999, padding: "2px 9px", fontSize: 12, fontWeight: 600 }}>{formatDuration(a.durationMinutes)} elapsed</span>
                    {a.hoursStatus === "staff_participants" && a.staffPersonMinutes > 0 && (
                      <span style={{ background: C.blueTint, color: C.blue, borderRadius: 999, padding: "2px 9px", fontSize: 12, fontWeight: 600 }}>{formatHours(a.staffPersonMinutes)}h staff</span>
                    )}
                    {a.volunteerPersonMinutes != null && a.volunteerPersonMinutes > 0 && (
                      <span style={{ background: C.blueTint, color: C.blue, borderRadius: 999, padding: "2px 9px", fontSize: 12, fontWeight: 600 }}>{formatHours(a.volunteerPersonMinutes)}h volunteer</span>
                    )}
                    {a.contractorHoursUnknown && (
                      <span style={{ background: C.border, color: C.muted, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>Contractor hours unknown</span>
                    )}
                    {a.contractorMinutes != null && a.contractorMinutes > 0 && (
                      <span style={{ background: C.blueTint, color: C.blue, borderRadius: 999, padding: "2px 9px", fontSize: 12, fontWeight: 600 }}>{formatHours(a.contractorMinutes)}h contractor</span>
                    )}
                    {(a.hoursStatus === "elapsed_only" || a.hoursStatus === "other_unknown") && (
                      <span style={{ color: C.dim, fontSize: 11 }}>{a.hoursStatus === "elapsed_only" ? "Elapsed time only" : "Labour unknown"}</span>
                    )}
                    {a.activityCategory && <span style={{ background: C.blueTint, color: C.blue, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{a.activityCategory}</span>}
                  </div>
                  <div style={{ color: C.muted, fontSize: 13, marginTop: 4, display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
                    {a.locations.length > 0 && <span><MapPin size={11} style={{ verticalAlign: "-1px", marginRight: 3 }} />{a.locations.map(l => l.name).join(", ")}</span>}
                    {a.participants.length > 0 && <span><Users size={11} style={{ verticalAlign: "-1px", marginRight: 3 }} />{a.participants.map(p => p.name).join(", ")}</span>}
                    <span style={{ color: C.dim }}>by {a.recordedByName}</span>
                  </div>
                  {a.notes && <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{a.notes}</div>}
                </div>
                {canDelete(a.recordedByUserId) && (
                  <button
                    type="button"
                    aria-label="Delete activity"
                    onClick={() => { if (window.confirm("Delete this activity entry?")) deleteActivity.mutate({ id: a.id }) }}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: C.dim, padding: 4 }}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      </>
      )}
    </div>
  )
}
