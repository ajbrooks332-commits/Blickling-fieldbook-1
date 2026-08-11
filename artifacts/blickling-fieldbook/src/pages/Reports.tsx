import React, { useState } from "react"
import { getGetReportSummaryQueryKey, useGetReportSummary } from "@workspace/api-client-react"
import { FileText, TrendingUp, AlertTriangle, CheckCircle2, Printer, Download } from "lucide-react"
import { apiFetch } from "@/lib/api"

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
  urgent: "#f85149",
  high: "#d29922",
  blue: "#58a6ff",
}

const HEAD = { fontFamily: "'Space Grotesk', sans-serif" }
const BODY = { fontFamily: "'Inter', sans-serif" }

export default function Reports() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const reportParams = { dateFrom, dateTo }
  const { data: summary, isLoading, error: loadError } = useGetReportSummary(reportParams, {
    query: { enabled: dateFrom <= dateTo, queryKey: getGetReportSummaryQueryKey(reportParams) },
  })

  const handlePrint = () => window.print()
  const handleExport = async () => {
    setExporting(true); setExportError(null)
    try {
      const query = new URLSearchParams({ dateFrom, dateTo })
      const response = await apiFetch(`/api/reports/export.csv?${query}`)
      if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error ?? "CSV export failed.")
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `blickling-fieldbook-${dateFrom}-to-${dateTo}.csv`; anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) { setExportError(error instanceof Error ? error.message : "CSV export failed.") }
    finally { setExporting(false) }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center" style={{ minHeight: 200 }}>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="animate-bounce w-2 h-2 rounded-full"
              style={{ backgroundColor: C.emerald, animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (dateFrom > dateTo) return <div role="alert" className="rounded-md border border-destructive/30 p-4">The start date must be on or before the end date.</div>
  if (loadError || !summary) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#21262d" }}>
          <FileText className="w-7 h-7" style={{ color: C.dim }} />
        </div>
        <p style={{ ...BODY, color: C.muted, fontSize: 14 }}>No report data available</p>
      </div>
    )
  }

  const maxCat = summary.byCategory && summary.byCategory.length > 0
    ? Math.max(...summary.byCategory.map(c => c.value))
    : 1

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 style={{ ...HEAD, fontSize: 22, fontWeight: 700, color: C.text }}>Management Reports</h1>
          <p style={{ ...BODY, fontSize: 13, color: C.muted, marginTop: 2 }}>Estate performance metrics and analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
            style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, ...HEAD }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.borderMid; (e.currentTarget as HTMLButtonElement).style.color = C.text }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = C.muted }}
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
            style={{ background: C.emerald, color: "#fff", border: "none", ...HEAD }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = C.emeraldDark}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = C.emerald}
          >
            <Download className="w-4 h-4" /> {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>
      {exportError && <p role="alert" className="text-sm text-red-400">{exportError}</p>}

      {/* Date range picker */}
      <div
        className="flex flex-col sm:flex-row gap-4 items-center p-4 rounded-xl print:hidden"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
      >
        <span style={{ ...BODY, fontSize: 13, color: C.muted, whiteSpace: "nowrap" }}>Date Range:</span>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{
              background: C.bg, border: `1px solid ${C.border}`, color: C.text,
              borderRadius: "0.625rem", padding: "0.4rem 0.75rem", fontSize: 13,
              ...BODY, outline: "none", width: 160,
            }}
            onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.emerald}
            onBlur={e => (e.target as HTMLInputElement).style.borderColor = C.border}
          />
          <span style={{ color: C.muted, fontSize: 13 }}>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{
              background: C.bg, border: `1px solid ${C.border}`, color: C.text,
              borderRadius: "0.625rem", padding: "0.4rem 0.75rem", fontSize: 13,
              ...BODY, outline: "none", width: 160,
            }}
            onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.emerald}
            onBlur={e => (e.target as HTMLInputElement).style.borderColor = C.border}
          />
        </div>
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "New Observations", value: summary.newObservations, color: C.blue, icon: TrendingUp },
          { label: "Actions Completed", value: summary.actionsCompleted, color: C.emerald, icon: CheckCircle2 },
          { label: "Overdue Actions", value: summary.overdueActions, color: C.urgent, icon: AlertTriangle },
          { label: "Urgent / High", value: (summary.urgentItems || 0) + (summary.highItems || 0), color: C.high, icon: AlertTriangle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderTop: `3px solid ${color}`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ ...BODY, fontSize: 12, color: C.muted }}>{label}</span>
              <Icon className="w-4 h-4" style={{ color, opacity: 0.5 }} />
            </div>
            <div style={{ ...HEAD, fontSize: 30, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Bottom cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <h2 style={{ ...HEAD, fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16 }}>
            Breakdown by Category
          </h2>
          {summary.byCategory && summary.byCategory.length > 0 ? (
            <div className="space-y-4">
              {summary.byCategory.map(cat => (
                <div key={cat.label}>
                  <div className="flex justify-between mb-1">
                    <span style={{ ...BODY, fontSize: 13, color: C.text }}>{cat.label}</span>
                    <span style={{ ...HEAD, fontSize: 13, fontWeight: 600, color: C.text }}>{cat.value}</span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ background: C.borderMid }}>
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${(cat.value / maxCat) * 100}%`,
                        backgroundColor: cat.colour || C.emerald,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ ...BODY, fontSize: 13, color: C.muted }}>No data for this period.</p>
          )}
        </div>

        {/* Safety & Access */}
        <div className="rounded-xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <h2 style={{ ...HEAD, fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16 }}>
            Safety &amp; Access Issues
          </h2>
          <div className="space-y-4">
            <div
              className="flex items-center justify-between p-4 rounded-lg"
              style={{
                background: "rgba(248,81,73,0.08)",
                border: "1px solid rgba(248,81,73,0.2)",
              }}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5" style={{ color: C.urgent }} />
                <span style={{ ...BODY, fontSize: 13, fontWeight: 500, color: C.text }}>Outstanding Safety Issues</span>
              </div>
              <span style={{ ...HEAD, fontSize: 24, fontWeight: 700, color: C.urgent }}>
                {summary.outstandingSafetyIssues || 0}
              </span>
            </div>
            <div
              className="flex items-center justify-between p-4 rounded-lg"
              style={{
                background: "rgba(210,153,34,0.08)",
                border: "1px solid rgba(210,153,34,0.2)",
              }}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5" style={{ color: C.high }} />
                <span style={{ ...BODY, fontSize: 13, fontWeight: 500, color: C.text }}>Outstanding Access Issues</span>
              </div>
              <span style={{ ...HEAD, fontSize: 24, fontWeight: 700, color: C.high }}>
                {summary.outstandingAccessIssues || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
