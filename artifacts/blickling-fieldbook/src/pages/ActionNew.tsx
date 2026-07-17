import React, { useState } from "react"
import { useCreateAction, useGetObservation } from "@workspace/api-client-react"
import { useLocation } from "wouter"
import { Save, Clock, Users, ArrowLeft, Check } from "lucide-react"

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
  const [location, setLocation] = useLocation()

  const searchParams = new URLSearchParams(window.location.search)
  const obsIdParam = searchParams.get('observationId')
  const observationId = obsIdParam ? Number(obsIdParam) : undefined

  const { data: obs, isLoading: obsLoading } = useGetObservation(observationId || 0, {
    query: { enabled: !!observationId, queryKey: ['observation', observationId] }
  })

  const createAction = useCreateAction()

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "normal" as any,
    status: "not_started" as any,
    dueDate: "",
    estimatedMinutes: "",
    equipmentRequired: false,
    contractorRequired: false,
    notes: ""
  })

  const [submitHover, setSubmitHover] = useState(false)
  const [cancelHover, setCancelHover] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createAction.mutate(
      {
        data: {
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          status: formData.status,
          dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
          estimatedMinutes: formData.estimatedMinutes ? Number(formData.estimatedMinutes) : undefined,
          equipmentRequired: formData.equipmentRequired,
          contractorRequired: formData.contractorRequired,
          notes: formData.notes,
          observationId: observationId
        }
      },
      {
        onSuccess: (data) => {
          setLocation(`/actions/${data.id}`)
        }
      }
    )
  }

  const canSubmit = formData.title.trim().length > 0 && !createAction.isPending

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
                {(['not_started', 'planned', 'in_progress'] as const).map(s => {
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
              {createAction.isPending ? (
                <>
                  <div style={{ display: "flex", gap: 3 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff", animation: `bounce 1s ${i * 0.15}s infinite` }} />
                    ))}
                  </div>
                  Saving...
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
