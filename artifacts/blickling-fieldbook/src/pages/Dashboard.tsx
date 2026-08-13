import React from "react"
import { useGetDashboardSummary, useGetDashboardCharts } from "@workspace/api-client-react"
import { Link, useLocation } from "wouter"
import {
  AlertTriangle, ArrowUp, Clock, Activity, ChevronRight,
  TrendingUp, MapPin, ClipboardList
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line
} from "recharts"

/* ─── Terrain tokens ──────────────────────────────────────────────────────── */
const C = {
  bg: "#0d1117",
  surface: "#161b22",
  border: "#30363d",
  text: "#e6edf3",
  muted: "#8b949e",
  dim: "#484f58",
  emerald: "#10b981",
  emeraldDim: "#065f46",
  emeraldTint: "rgba(16,185,129,0.08)",
  urgent: "#f85149",
  urgentTint: "rgba(248,81,73,0.12)",
  high: "#d29922",
  highTint: "rgba(210,153,34,0.12)",
  blue: "#58a6ff",
  blueTint: "rgba(88,166,255,0.12)",
  amber: "#d29922",
  amberTint: "rgba(210,153,34,0.1)",
}

const HEAD = { fontFamily: "'Space Grotesk', sans-serif" }
const BODY = { fontFamily: "'Inter', sans-serif" }

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function priorityConfig(p: string) {
  switch (p) {
    case "urgent": return { color: C.urgent, bg: C.urgentTint, label: "Urgent" }
    case "high":   return { color: C.high, bg: C.highTint, label: "High" }
    case "normal": return { color: C.blue, bg: C.blueTint, label: "Normal" }
    default:       return { color: C.dim, bg: "rgba(72,79,88,0.15)", label: "Low" }
  }
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

function statusColor(s: string) {
  switch (s) {
    case "action_required": return C.urgent
    case "under_review": return "#a78bfa"
    case "submitted": return C.blue
    case "monitoring": return "#34d399"
    case "resolved": return C.emerald
    default: return C.dim
  }
}

/* ─── Metric tile ─────────────────────────────────────────────────────────── */
function MetricTile({
  label, value, icon: Icon, color, href,
}: {
  label: string; value: number; icon: React.ElementType; color: string; href: string
}) {
  const [, setLocation] = useLocation()
  return (
    <button
      onClick={() => setLocation(href)}
      className="rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden w-full text-left transition-all"
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${color}`,
        cursor: "pointer",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = "#1c2128"
        el.style.transform = "translateY(-1px)"
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = C.surface
        el.style.transform = "translateY(0)"
      }}
    >
      {/* Glow */}
      <div
        className="absolute top-0 right-0 w-16 h-16 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${color}18 0%, transparent 70%)` }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ ...BODY, color: C.muted }}>
          {label}
        </span>
        <Icon className="h-3.5 w-3.5" style={{ color }} />
      </div>
      <div className="flex items-end justify-between">
        <div className="text-3xl font-bold" style={{ ...HEAD, color }}>{value}</div>
        <ChevronRight className="h-3.5 w-3.5 mb-1" style={{ color: C.dim }} />
      </div>
    </button>
  )
}

/* ─── Category bar row ────────────────────────────────────────────────────── */
function CategoryBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-28 shrink-0 truncate" style={{ ...BODY, color: C.muted }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: C.border }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.round((value / max) * 100)}%`, background: color }}
        />
      </div>
      <span className="text-xs w-4 text-right shrink-0" style={{ ...BODY, color: C.muted }}>{value}</span>
    </div>
  )
}

/* ─── Observation row ─────────────────────────────────────────────────────── */
function ObsRow({ obs }: { obs: any }) {
  const p = priorityConfig(obs.priority)
  const sc = statusColor(obs.status)
  return (
    <Link href={`/observations/${obs.id}`}>
      <div
        className="px-4 py-3 rounded-xl flex items-start gap-3 cursor-pointer transition-colors"
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${p.color}` }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = p.color }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border }}
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="text-sm font-medium leading-snug line-clamp-1" style={{ ...BODY, color: C.text }}>
            {obs.title}
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
            {obs.namedLocationName && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />{obs.namedLocationName}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ ...BODY, color: p.color, background: p.bg }}
          >
            {p.label.toUpperCase()}
          </span>
          <span className="text-[10px] font-medium" style={{ ...BODY, color: sc }}>
            {statusLabel(obs.status)}
          </span>
        </div>
      </div>
    </Link>
  )
}

/* ─── Main component ──────────────────────────────────────────────────────── */
export default function Dashboard() {
  const [, setLocation] = useLocation()
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary()
  const { data: charts, isLoading: loadingCharts } = useGetDashboardCharts()

  if (loadingSummary || loadingCharts) {
    return (
      <div className="flex items-center justify-center h-64 gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ background: C.emerald, animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    )
  }

  if (!summary || !charts) {
    return <div className="p-8 text-center text-sm" style={{ color: C.muted }}>Failed to load dashboard.</div>
  }

  const now = new Date()
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening"
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  const catMax = Math.max(...(charts.byCategory.map(c => c.value) || [1]), 1)
  const catColors = [C.emerald, C.blue, C.high, "#a78bfa", C.dim]

  // Recent observations (highest priority first, take 4)
  const priorityOrder = ["urgent", "high", "normal", "low"]
  const recentObs = [...(charts.byCategory || [])]

  return (
    <div className="space-y-5 max-w-2xl mx-auto lg:max-w-none">

      {/* ── Welcome ─────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="text-xs font-medium uppercase tracking-widest" style={{ ...BODY, color: C.dim }}>
          {dateStr} · Blickling Estate
        </div>
        <h1 className="text-2xl font-bold" style={{ ...HEAD, color: C.text }}>
          Overview
        </h1>
      </div>

      {/* ── Urgent alert banner ──────────────────────────────────────────── */}
      {summary.urgentObservations > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: C.urgentTint, border: `1px solid rgba(248,81,73,0.25)` }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: C.urgent }} />
          <p className="text-sm flex-1" style={{ ...BODY, color: C.urgent }}>
            <span className="font-semibold">{summary.urgentObservations} urgent issue{summary.urgentObservations !== 1 ? "s" : ""}</span>
            {" "}require immediate attention
          </p>
          <Link href="/observations?priority=urgent">
            <ChevronRight className="h-4 w-4" style={{ color: C.urgent }} />
          </Link>
        </div>
      )}

      {/* ── Secondary stats callouts ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setLocation("/actions/my")}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl w-full text-left transition-all"
          style={{ background: C.emeraldTint, border: `1px solid rgba(16,185,129,0.2)`, cursor: "pointer" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.14)" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.emeraldTint }}
        >
          <Activity className="h-4 w-4 shrink-0" style={{ color: C.emerald }} />
          <div className="flex-1">
            <div className="text-sm font-bold" style={{ ...HEAD, color: C.emerald }}>{summary.actionsDueThisWeek}</div>
            <div className="text-[11px]" style={{ ...BODY, color: C.muted }}>Due this week</div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: C.dim }} />
        </button>
        <button
          onClick={() => setLocation("/observations")}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl w-full text-left transition-all"
          style={{ background: C.blueTint, border: `1px solid rgba(88,166,255,0.2)`, cursor: "pointer" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(88,166,255,0.16)" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.blueTint }}
        >
          <TrendingUp className="h-4 w-4 shrink-0" style={{ color: C.blue }} />
          <div className="flex-1">
            <div className="text-sm font-bold" style={{ ...HEAD, color: C.blue }}>{summary.observationsLast30Days}</div>
            <div className="text-[11px]" style={{ ...BODY, color: C.muted }}>New last 30d</div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: C.dim }} />
        </button>
        <button
          onClick={() => setLocation("/activities")}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl w-full text-left transition-all"
          style={{ background: "rgba(167,139,250,0.08)", border: `1px solid rgba(167,139,250,0.2)`, cursor: "pointer" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.14)" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,0.08)" }}
        >
          <ClipboardList className="h-4 w-4 shrink-0" style={{ color: "#a78bfa" }} />
          <div className="flex-1">
            <div className="text-sm font-bold" style={{ ...HEAD, color: "#a78bfa" }}>Activities</div>
            <div className="text-[11px]" style={{ ...BODY, color: C.muted }}>Log & report</div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: C.dim }} />
        </button>
      </div>

      {/* ── Metric tiles ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricTile label="Urgent Issues"   value={summary.urgentObservations} icon={AlertTriangle} color={C.urgent}  href="/observations?priority=urgent" />
        <MetricTile label="High Priority"   value={summary.highObservations}   icon={ArrowUp}       color={C.high}    href="/observations?priority=high" />
        <MetricTile label="Overdue Actions" value={summary.overdueActions}      icon={Clock}         color={C.urgent}  href="/actions?overdue=true" />
        <MetricTile label="Open Records"    value={summary.openObservations}    icon={Activity}      color={C.emerald} href="/observations" />
      </div>

      {/* ── Charts row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Category breakdown */}
        <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold" style={{ ...HEAD, color: C.text }}>Category Breakdown</h2>
              <p className="text-xs mt-0.5" style={{ ...BODY, color: C.muted }}>Active observations by type</p>
            </div>
            <TrendingUp className="h-4 w-4" style={{ color: C.dim }} />
          </div>
          <div className="space-y-3">
            {charts.byCategory.slice(0, 6).map((c, i) => (
              <CategoryBar
                key={c.label}
                label={c.label}
                value={c.value}
                max={catMax}
                color={c.colour || catColors[i % catColors.length]}
              />
            ))}
          </div>
        </div>

        {/* Observations over time */}
        <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold" style={{ ...HEAD, color: C.text }}>Activity — 30 days</h2>
              <p className="text-xs mt-0.5" style={{ ...BODY, color: C.muted }}>New observations over time</p>
            </div>
          </div>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.observationsOverTime} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                <XAxis
                  dataKey="date"
                  tickFormatter={v => v.substring(5)}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: C.dim }}
                />
                <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: C.dim }} />
                <Tooltip
                  contentStyle={{
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 8, fontSize: 12, color: C.text,
                  }}
                  itemStyle={{ color: C.emerald }}
                  cursor={{ stroke: C.border }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={C.emerald}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: C.emerald, stroke: C.surface, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── By status bar chart ──────────────────────────────────────────── */}
      {charts.byStatus?.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold" style={{ ...HEAD, color: C.text }}>By Status</h2>
              <p className="text-xs mt-0.5" style={{ ...BODY, color: C.muted }}>Active observations by workflow stage</p>
            </div>
          </div>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.byStatus} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                <XAxis
                  dataKey="label"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: C.dim }}
                  tickFormatter={v => {
                    const s = v.replace(/_/g, " ")
                    return s.length > 10 ? s.substring(0, 10) + "…" : s
                  }}
                />
                <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: C.dim }} />
                <Tooltip
                  contentStyle={{
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 8, fontSize: 12, color: C.text,
                  }}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  formatter={(v: number, name: string, props: any) => [v, props.payload?.label]}
                />
                <Bar dataKey="value" fill={C.emerald} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Quick stats row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="text-2xl font-bold" style={{ ...HEAD, color: C.emerald }}>{summary.actionsCompletedLast30Days}</div>
          <div className="text-xs mt-1" style={{ ...BODY, color: C.muted }}>Actions completed (30d)</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="text-2xl font-bold" style={{ ...HEAD, color: C.blue }}>{summary.overdueActions}</div>
          <div className="text-xs mt-1" style={{ ...BODY, color: C.muted }}>Overdue actions</div>
        </div>
      </div>

    </div>
  )
}
