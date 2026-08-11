import React, { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  useCreateActivity, useDeleteActivity, useGetMe, useListActivities,
  useListActivityTypes, useListAssignees, useListLocations,
  getListActivitiesQueryKey,
} from "@workspace/api-client-react"
import { Check, Clock, Loader2, MapPin, Plus, Trash2, Users, X } from "lucide-react"

const C = {
  bg: "#0d1117",
  surface: "#161b22",
  border: "#30363d",
  text: "#e6edf3",
  muted: "#8b949e",
  dim: "#484f58",
  emerald: "#10b981",
  emeraldTint: "rgba(16,185,129,0.08)",
  blue: "#58a6ff",
}

const HEAD = { fontFamily: "'Space Grotesk', sans-serif" }
const BODY = { fontFamily: "'Inter', sans-serif" }

const labelStyle: React.CSSProperties = {
  ...HEAD, fontSize: 13, fontWeight: 600, color: C.muted, display: "block", marginBottom: 6,
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

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60), m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function formatDate(iso: string) {
  const today = todayISO()
  if (iso === today) return "Today"
  const y = new Date(); y.setDate(y.getDate() - 1)
  const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`
  if (iso === yesterday) return "Yesterday"
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

export default function Activities() {
  const { data: me } = useGetMe()
  const { data: types } = useListActivityTypes()
  const { data: locations } = useListLocations()
  const { data: assignees } = useListAssignees()
  const queryClient = useQueryClient()

  const [typeId, setTypeId] = useState<number | null>(null)
  const [locationId, setLocationId] = useState<number | null>(null)
  const [participants, setParticipants] = useState<number[]>([])
  const [duration, setDuration] = useState<number | null>(null)
  const [customDuration, setCustomDuration] = useState(false)
  const [customHours, setCustomHours] = useState("")
  const [activityDate, setActivityDate] = useState(todayISO())
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const { data: list, isLoading: listLoading } = useListActivities({ limit: 100 })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() })
  const createActivity = useCreateActivity({ mutation: { onSuccess: () => {
    invalidate()
    setTypeId(null); setLocationId(null); setParticipants([]); setDuration(null)
    setCustomDuration(false); setCustomHours(""); setNotes(""); setError(null)
    setSaved(true); window.setTimeout(() => setSaved(false), 2500)
  }, onError: () => setError("Could not save the activity. Please try again.") } })
  const deleteActivity = useDeleteActivity({ mutation: { onSuccess: invalidate } })

  const activeLocations = useMemo(() => (locations ?? []).filter(l => l.active), [locations])

  const effectiveDuration = customDuration
    ? Math.round(Number(customHours || "0") * 60)
    : duration

  const canSave = typeId != null && effectiveDuration != null && effectiveDuration >= 5 && effectiveDuration <= 1440

  const submit = () => {
    if (!canSave) {
      setError(typeId == null ? "Pick an activity first" : "Pick how long it took")
      return
    }
    setError(null)
    createActivity.mutate({ data: {
      activityTypeId: typeId!,
      namedLocationId: locationId,
      activityDate,
      durationMinutes: effectiveDuration!,
      participantUserIds: participants,
      notes: notes.trim() ? notes.trim() : null,
    } })
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
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ ...HEAD, fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Daily Activities</h1>
        <p style={{ color: C.muted, fontSize: 13, margin: "4px 0 0" }}>Tap to record what you did today — no typing needed.</p>
      </div>

      {/* Quick add card */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "0.875rem", padding: 16, marginBottom: 24 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>What did you do?</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(types ?? []).map(t => (
              <Chip key={t.id} selected={typeId === t.id} onClick={() => setTypeId(typeId === t.id ? null : t.id)}>{t.name}</Chip>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}><MapPin size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Where?</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {activeLocations.map(l => (
              <Chip key={l.id} selected={locationId === l.id} onClick={() => setLocationId(locationId === l.id ? null : l.id)}>{l.name}</Chip>
            ))}
            {activeLocations.length === 0 && <span style={{ color: C.dim, fontSize: 13 }}>No locations set up yet — optional</span>}
          </div>
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
        </div>

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
              style={{
                marginTop: 10, background: C.bg, border: `1px solid ${C.border}`, color: C.text,
                borderRadius: "0.625rem", padding: "0.625rem 0.75rem", fontSize: 14, width: 160, outline: "none", ...BODY,
              }}
            />
          )}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date" value={activityDate} max={todayISO()}
              onChange={e => setActivityDate(e.target.value)}
              style={{
                background: C.bg, border: `1px solid ${C.border}`, color: C.text,
                borderRadius: "0.625rem", padding: "0.5rem 0.75rem", fontSize: 14, outline: "none", ...BODY, colorScheme: "dark",
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Note (optional)</label>
            <input
              type="text" placeholder="Anything worth adding…" value={notes} maxLength={2000}
              onChange={e => setNotes(e.target.value)}
              style={{
                background: C.bg, border: `1px solid ${C.border}`, color: C.text,
                borderRadius: "0.625rem", padding: "0.5rem 0.75rem", fontSize: 14, width: "100%", outline: "none", ...BODY, boxSizing: "border-box",
              }}
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
            fontSize: 15, fontWeight: 700, color: canSave ? "#04150e" : C.dim,
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
                    <span style={{ background: C.emeraldTint, color: C.emerald, borderRadius: 999, padding: "2px 9px", fontSize: 12, fontWeight: 600 }}>{formatDuration(a.durationMinutes)}</span>
                  </div>
                  <div style={{ color: C.muted, fontSize: 13, marginTop: 4, display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
                    {a.namedLocationName && <span><MapPin size={11} style={{ verticalAlign: "-1px", marginRight: 3 }} />{a.namedLocationName}</span>}
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
    </div>
  )
}
