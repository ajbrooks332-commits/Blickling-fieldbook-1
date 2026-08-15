import React, { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useCreateAction, useCreateLocation, useGetMe, useGetObservation, useListAssignees, useListLocations, getListLocationsQueryKey } from "@workspace/api-client-react"
import { useLocation, useSearch } from "wouter"
import { Save, Clock, MapPin, ArrowLeft, Check, Plus } from "lucide-react"
import { queueAction } from "@/lib/offline"
import { isRealCalendarDate } from "@/lib/utils"

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
    case "in_progress":     return "#10b981"
    default:                return "#8b949e"
  }
}
function statusBg(s: string) { return statusColor(s) + "1a" }
function statusLabel(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) }

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
  boxSizing: "border-box",
}

const labelStyle: React.CSSProperties = {
  ...HEAD,
  fontSize: 13,
  fontWeight: 600,
  color: C.muted,
  display: "block",
  marginBottom: 6,
}

export default function ActionNew() {
  const [, setLocation] = useLocation()
  const search = useSearch()

  const searchParams = new URLSearchParams(search)
  const obsIdParam = searchParams.get('observationId')
  const observationId = obsIdParam ? Number(obsIdParam) : undefined

  const { data: obs } = useGetObservation(observationId || 0, {
    query: { enabled: !!observationId, queryKey: ['observation', observationId] }
  })

  const createAction = useCreateAction()
  const { data: me } = useGetMe()
  const { data: assignees = [] } = useListAssignees()
  const { data: locations = [] } = useListLocations()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "normal" as any,
    status: "not_started" as any,
    dueDate: "",
    estimatedMinutes: "",
    equipmentRequired: false,
    contractorRequired: false,
    assignedToUserId: "",
    namedLocationId: ""
  })
  const [error, setError] = useState<string | null>(null)
  const [queueing, setQueueing] = useState(false)
  const [addingLocation, setAddingLocation] = useState(false)
  const [newLocationName, setNewLocationName] = useState("")

  const createLocation = useCreateLocation({ mutation: {
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() })
      setFormData(d => ({ ...d, namedLocationId: String(row.id) }))
      setAddingLocation(false)
      setNewLocationName("")
    },
    onError: () => setError("Could not add that location — please try again."),
  } })

  const submitNewLocation = () => {
    const name = newLocationName.trim()
    if (!name) return
    createLocation.mutate({ data: { name } })
  }

  const [submitHover, setSubmitHover] = useState(false)
  const [cancelHover, setCancelHover] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!me) return setError("Your session could not be verified. Reload the app and try again.")
    if (formData.dueDate && !isRealCalendarDate(formData.dueDate)) {
      return setError("The due date is not a real calendar date.")
    }
    const offlineId = crypto.randomUUID()
    const data = {
      title: formData.title.trim(), description: formData.description.trim() || undefined,
      priority: formData.priority, status: formData.status,
      assignedToUserId: Number(formData.assignedToUserId), dueDate: formData.dueDate || undefined,
      estimatedMinutes: formData.estimatedMinutes ? Number(formData.estimatedMinutes) : undefined,
      equipmentRequired: formData.equipmentRequired, contractorRequired: formData.contractorRequired,
      namedLocationId: formData.namedLocationId ? Number(formData.namedLocationId) : undefined,
      observationId, offlineId,
    }
    if (!navigator.onLine) {
      setQueueing(true)
      try { await queueAction({ ...data, createdOffline: true }, me.id); setLocation("/actions?queued=1") }
      catch { setError("The action could not be saved on this device.") }
      finally { setQueueing(false) }
      return
    }
    try {
      const created = await createAction.mutateAsync({ data })
      const transition = (created as { observationTransition?: { applied: boolean; observationStatus: string } | null }).observationTransition
      if (transition && !transition.applied) {
        // The linked observation stays in its current status (e.g. draft) because
        // the workflow does not allow a direct move to "action required".
        setLocation(`/actions/${created.id}?obsStatusUnchanged=${encodeURIComponent(transition.observationStatus)}`)
      } else {
        setLocation(`/actions/${created.id}`)
      }
    } catch (err) {
      if (err instanceof TypeError) {
        setQueueing(true)
        try { await queueAction({ ...data, createdOffline: true }, me.id); setLocation("/actions?queued=1") }
        catch { setError("The connection failed and the action could not be queued.") }
        finally { setQueueing(false) }
      } else setError(err instanceof Error ? err.message : "Action could not be created.")
    }
  }

  const canSubmit = formData.title.trim().length > 0 && Boolean(formData.assignedToUserId) && !createAction.isPending && !queueing

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 0 40px" }}>
      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 28 }}>
        <button
          onClick={() => window.history.back()}
          style={{
            background: "transparent",
            border: `1px solid ${C.border}`,
            borderRadius: "0.5rem",
            color: C.muted,
            cursor: "pointer",
            padding: "6px 8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 2,
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 style={{ ...HEAD, fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>New Action</h1>
          {obs ? (
            <p style={{ ...BODY, fontSize: 13, color: C.muted, marginTop: 4 }}>
              For:{" "}
              <span style={{
                color: C.emerald,
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
              }}>
                {obs.referenceNumber}
              </span>{" "}
              <span style={{ color: C.muted }}>{obs.title}</span>
            </p>
          ) : (
            <p style={{ ...BODY, fontSize: 13, color: C.muted, marginTop: 4 }}>Create a new maintenance or management action</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Main Form Card */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}>
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: 22 }}>

            {/* Title */}
            <div>
              <label style={labelStyle}>
                Action Title <span style={{ color: C.urgent }}>*</span>
              </label>
              <input
                required
                style={inputStyle}
                placeholder="e.g. Clear fallen branch and stack cordwood"
                value={formData.title}
                onChange={e => setFormData(d => ({ ...d, title: e.target.value }))}
                onFocus={e => (e.target.style.borderColor = C.emerald)}
                onBlur={e => (e.target.style.borderColor = C.border)}
              />
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                style={{ ...inputStyle, minHeight: 88, resize: "vertical" }}
                placeholder="Detailed instructions or notes..."
                value={formData.description}
                onChange={e => setFormData(d => ({ ...d, description: e.target.value }))}
                onFocus={e => (e.target.style.borderColor = C.emerald)}
                onBlur={e => (e.target.style.borderColor = C.border)}
              />
            </div>

            {/* Priority selector */}
            <div>
              <label style={labelStyle}>Priority</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(['low', 'normal', 'high', 'urgent'] as const).map(p => {
                  const cfg = priorityConfig(p)
                  const selected = formData.priority === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFormData(d => ({ ...d, priority: p as any }))}
                      style={{
                        flex: 1,
                        padding: "9px 4px",
                        background: selected ? cfg.bg : "transparent",
                        border: `1px solid ${selected ? cfg.color : C.border}`,
                        borderRadius: "0.625rem",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        ...HEAD,
                        fontSize: 11,
                        fontWeight: 700,
                        color: selected ? cfg.color : C.dim,
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.06em",
                        display: "flex",
                        flexDirection: "column" as const,
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      {selected && <Check size={12} color={cfg.color} />}
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Status selector */}
            <div>
              <label style={labelStyle}>Status</label>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
                {(['not_started', 'planned'] as const).map(s => {
                  const selected = formData.status === s
                  const col = statusColor(s)
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData(d => ({ ...d, status: s as any }))}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 9999,
                        border: `1px solid ${selected ? col : C.border}`,
                        background: selected ? col + "1a" : "transparent",
                        color: selected ? col : C.muted,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        ...HEAD,
                        fontSize: 12,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      {selected && <Check size={11} color={col} />}
                      {statusLabel(s)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Location */}
            <div>
              <label htmlFor="action-location" style={labelStyle}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><MapPin size={13} color={C.dim} /> Location</span>
              </label>
              <select
                id="action-location"
                style={inputStyle}
                value={addingLocation ? "__new__" : formData.namedLocationId}
                onChange={e => {
                  if (e.target.value === "__new__") { setAddingLocation(true); setNewLocationName("") }
                  else { setAddingLocation(false); setFormData(d => ({ ...d, namedLocationId: e.target.value })) }
                }}
              >
                <option value="">No specific location</option>
                {locations.filter(l => l.active).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                <option value="__new__">Somewhere else… (add new)</option>
              </select>
              {addingLocation && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input
                    type="text" placeholder="Type the location, e.g. Woodgate" value={newLocationName} maxLength={200}
                    autoFocus
                    onChange={e => setNewLocationName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitNewLocation() } }}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button" onClick={submitNewLocation} disabled={!newLocationName.trim() || createLocation.isPending}
                    style={{
                      padding: "8px 16px", background: newLocationName.trim() ? C.emerald : C.border, border: "none",
                      borderRadius: "0.625rem", cursor: newLocationName.trim() ? "pointer" : "not-allowed",
                      ...HEAD, fontSize: 13, fontWeight: 700, color: newLocationName.trim() ? "#04150e" : C.dim,
                      display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
                    }}
                  >
                    <Plus size={13} />{createLocation.isPending ? "Adding…" : "Add"}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="action-assignee" style={labelStyle}>Assigned to <span style={{ color: C.urgent }}>*</span></label>
              <select id="action-assignee" required style={inputStyle} value={formData.assignedToUserId}
                onChange={e => setFormData(d => ({ ...d, assignedToUserId: e.target.value }))}>
                <option value="">Select a member of staff</option>
                {assignees.map(person => <option key={person.id} value={person.id}>{person.name} — {person.role.replace('_', ' ')}</option>)}
              </select>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: C.borderMid }} />

            {/* Due Date + Est. Minutes */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    Due Date
                  </span>
                </label>
                <input
                  type="date"
                  style={{
                    ...inputStyle,
                    colorScheme: "dark",
                  }}
                  value={formData.dueDate}
                  onChange={e => setFormData(d => ({ ...d, dueDate: e.target.value }))}
                  onFocus={e => (e.target.style.borderColor = C.emerald)}
                  onBlur={e => (e.target.style.borderColor = C.border)}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Clock size={13} color={C.dim} /> Est. Minutes
                  </span>
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    type="number"
                    min="0"
                    style={{ ...inputStyle, paddingRight: 60 }}
                    placeholder="e.g. 120"
                    value={formData.estimatedMinutes}
                    onChange={e => setFormData(d => ({ ...d, estimatedMinutes: e.target.value }))}
                    onFocus={e => (e.target.style.borderColor = C.emerald)}
                    onBlur={e => (e.target.style.borderColor = C.border)}
                  />
                  <span style={{
                    position: "absolute",
                    right: 10,
                    ...BODY,
                    fontSize: 12,
                    color: C.dim,
                    pointerEvents: "none",
                  }}>min</span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: C.borderMid }} />

            {/* Toggle flags */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { id: 'equipmentRequired', label: 'Specialist Equipment Required', desc: 'Tractor, chainsaw, cherry-picker etc.' },
                { id: 'contractorRequired', label: 'External Contractor Required', desc: 'Requires outside expertise or certification' },
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
                      padding: "12px 14px",
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

          {/* Footer */}
          {error && <div role="alert" style={{ margin: "16px 24px 0", color: C.urgent, fontSize: 13 }}>{error}</div>}
          <div style={{
            borderTop: `1px solid ${C.borderMid}`,
            padding: "16px 24px",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            background: C.bg,
          }}>
            <button
              type="button"
              onClick={() => window.history.back()}
              onMouseEnter={() => setCancelHover(true)}
              onMouseLeave={() => setCancelHover(false)}
              style={{
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: "0.625rem",
                color: cancelHover ? C.text : C.muted,
                ...HEAD,
                fontSize: 14,
                fontWeight: 600,
                padding: "10px 20px",
                cursor: "pointer",
                transition: "all 0.15s",
                ...(cancelHover ? { background: C.borderMid } : {}),
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              onMouseEnter={() => setSubmitHover(true)}
              onMouseLeave={() => setSubmitHover(false)}
              style={{
                background: !canSubmit ? C.emeraldDim : submitHover ? C.emeraldDark : C.emerald,
                border: "none",
                borderRadius: "0.625rem",
                color: "#fff",
                ...HEAD,
                fontSize: 14,
                fontWeight: 700,
                padding: "10px 24px",
                cursor: !canSubmit ? "not-allowed" : "pointer",
                opacity: !canSubmit ? 0.6 : 1,
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              {createAction.isPending || queueing ? (
                <>
                  <div style={{ display: "flex", gap: 3 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff", animation: `bounce 1s ${i * 0.15}s infinite` }} />
                    ))}
                  </div>
                  {queueing ? "Saving offline…" : "Saving…"}
                </>
              ) : (
                <><Save size={15} /> Create Action</>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
