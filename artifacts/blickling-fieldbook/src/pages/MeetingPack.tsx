import React from "react";
import { useSearch } from "wouter";
import { apiFetch } from "@/lib/api";
import { Printer, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

interface PackTask {
  id: number; referenceNumber: string; title: string; description: string | null;
  status: string; priority: string; dueDate: string | null; isOverdue: boolean;
  assignedToName: string | null; namedLocationName: string | null;
  observationRef: string | null; latestNote: string | null;
}
interface Pack {
  generatedAt: string;
  filters: { priority?: string; overdue?: string; search?: string; assignedUserId?: number };
  counts: { total: number; urgent: number; high: number; overdue: number; dueThisWeek: number; unassigned: number };
  tasks: PackTask[];
}

const statusLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function MeetingPack() {
  const searchStr = useSearch();
  const [pack, setPack] = React.useState<Pack | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(searchStr);
        const forward = new URLSearchParams();
        for (const key of ["priority", "overdue", "search", "assignedUserId"]) {
          const value = params.get(key);
          if (value) forward.set(key, value);
        }
        const response = await apiFetch(`/api/actions/meeting-pack${forward.size ? `?${forward}` : ""}`);
        if (!response.ok) throw new Error("Could not load the meeting pack.");
        const body = await response.json() as Pack;
        if (!cancelled) setPack(body);
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the meeting pack."); }
    })();
    return () => { cancelled = true; };
  }, [searchStr]);

  if (error) return <div role="alert" className="p-6 text-sm">{error}</div>;
  if (!pack) return <div className="p-6 text-sm">Preparing meeting pack…</div>;

  const filterBits: string[] = [];
  if (pack.filters.priority) filterBits.push(`Priority: ${pack.filters.priority}`);
  if (pack.filters.overdue === "true") filterBits.push("Overdue only");
  if (pack.filters.search) filterBits.push(`Search: “${pack.filters.search}”`);
  const generated = new Date(pack.generatedAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" });

  return <div className="meeting-pack">
    <style>{`
      .meeting-pack { background: #fff; color: #111; font-family: Georgia, 'Times New Roman', serif; padding: 16px; min-height: 100vh; }
      .meeting-pack table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
      .meeting-pack th, .meeting-pack td { border: 1px solid #999; padding: 5px 7px; text-align: left; vertical-align: top; }
      .meeting-pack th { background: #eee; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.03em; }
      .meeting-pack tr { break-inside: avoid; }
      .meeting-pack thead { display: table-header-group; }
      .mp-overdue { color: #b00020; font-weight: 700; }
      .mp-decision { min-width: 190px; }
      .mp-toolbar { display: flex; gap: 8px; margin-bottom: 14px; }
      .mp-toolbar a, .mp-toolbar button { font-family: inherit; font-size: 11pt; padding: 8px 14px; border: 1px solid #333; background: #fff; color: #111; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; }
      .mp-footer { margin-top: 10px; font-size: 9pt; color: #555; }
      @page { size: A4 landscape; margin: 12mm; }
      @media print {
        .mp-toolbar { display: none; }
        .meeting-pack { padding: 0; }
      }
    `}</style>
    <div className="mp-toolbar">
      <Link href="/actions"><ArrowLeft size={16} /> Back to Actions</Link>
      <button type="button" onClick={() => window.print()}><Printer size={16} /> Print / Save as PDF</button>
    </div>
    <h1 style={{ fontSize: "16pt", margin: "0 0 2px" }}>Blickling Fieldbook — Open tasks for meeting</h1>
    <p style={{ margin: "0 0 8px", fontSize: "10pt" }}>
      Generated {generated}. {filterBits.length ? `Filters applied: ${filterBits.join("; ")}.` : "No filters applied — all open tasks."} Completed and cancelled tasks are excluded.
    </p>
    <p style={{ margin: "0 0 12px", fontSize: "10.5pt" }}>
      <strong>{pack.counts.total}</strong> open · <strong className="mp-overdue">{pack.counts.overdue} overdue</strong> ·
      {" "}<strong>{pack.counts.urgent}</strong> urgent · <strong>{pack.counts.high}</strong> high ·
      {" "}<strong>{pack.counts.dueThisWeek}</strong> due this week · <strong>{pack.counts.unassigned}</strong> unassigned
    </p>
    <table>
      <thead><tr>
        <th>Ref</th><th>Task</th><th>Location</th><th>Assignee</th><th>Priority</th><th>Status</th><th>Due</th>
        <th>Linked obs / latest note</th><th className="mp-decision">Meeting decision / update</th>
      </tr></thead>
      <tbody>
        {pack.tasks.map((task) => <tr key={task.id}>
          <td>{task.referenceNumber}</td>
          <td><strong>{task.title}</strong>{task.description ? <><br /><span style={{ fontSize: "9.5pt" }}>{task.description.slice(0, 180)}{task.description.length > 180 ? "…" : ""}</span></> : null}</td>
          <td>{task.namedLocationName ?? "—"}</td>
          <td>{task.assignedToName ?? <em>Unassigned</em>}</td>
          <td className={task.priority === "urgent" ? "mp-overdue" : undefined}>{task.priority}</td>
          <td>{statusLabel(task.status)}</td>
          <td className={task.isOverdue ? "mp-overdue" : undefined}>{dateLabel(task.dueDate)}{task.isOverdue ? " (overdue)" : ""}</td>
          <td>{task.observationRef ? <>Obs {task.observationRef}<br /></> : null}{task.latestNote ? `${task.latestNote.slice(0, 140)}${task.latestNote.length > 140 ? "…" : ""}` : "—"}</td>
          <td className="mp-decision">&nbsp;</td>
        </tr>)}
        {pack.tasks.length === 0 && <tr><td colSpan={9}>No open tasks match the applied filters.</td></tr>}
      </tbody>
    </table>
    <p className="mp-footer">Blickling Fieldbook · generated {generated} · page numbers are added by the browser's print footer.</p>
  </div>;
}
