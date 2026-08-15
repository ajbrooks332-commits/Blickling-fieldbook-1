import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListArchivedObservations, useListArchivedActions, useRestoreObservation, useRestoreAction,
  getListArchivedObservationsQueryKey, getListArchivedActionsQueryKey,
  getListObservationsQueryKey, getListActionsQueryKey,
} from "@workspace/api-client-react";
import { ArchiveRestore, Loader2 } from "lucide-react";

type Row = Record<string, unknown>;

function formatDate(value: unknown): string {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function Archive() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const observations = useListArchivedObservations({ query: { queryKey: getListArchivedObservationsQueryKey() } });
  const actions = useListArchivedActions({ query: { queryKey: getListArchivedActionsQueryKey() } });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListArchivedObservationsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListArchivedActionsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListObservationsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListActionsQueryKey() }),
    ]);
  };

  const restoreObservation = useRestoreObservation({ mutation: {
    onSuccess: async () => { setMessage("Observation restored."); await refresh(); },
    onError: (err) => setMessage(err instanceof Error ? err.message : "Restore failed."),
  } });
  const restoreAction = useRestoreAction({ mutation: {
    onSuccess: async () => { setMessage("Task restored."); await refresh(); },
    onError: (err) => setMessage(err instanceof Error ? err.message : "Restore failed. If it belongs to an archived observation, restore that first."),
  } });

  const observationRows = ((observations.data as { observations?: Row[] } | undefined)?.observations ?? []);
  const actionRows = ((actions.data as { actions?: Row[] } | undefined)?.actions ?? []);
  const busy = restoreObservation.isPending || restoreAction.isPending;

  const section = (
    title: string, loading: boolean, rows: Row[], empty: string,
    render: (row: Row) => React.ReactNode,
  ) => (
    <section className="rounded-xl border bg-card p-5 space-y-3" aria-label={title}>
      <h2 className="font-semibold">{title}</h2>
      {loading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Loading…</p>
        : rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p>
        : <ul className="divide-y">{rows.map(render)}</ul>}
    </section>
  );

  return <div className="mx-auto max-w-3xl space-y-6 p-4">
    <div>
      <h1 className="text-xl font-semibold">Archive</h1>
      <p className="text-sm text-muted-foreground">Archived records are kept with their full history and can be restored at any time. Nothing here is permanently deleted.</p>
    </div>
    {message && <p role="status" className="rounded-md border bg-card px-3 py-2 text-sm">{message}</p>}
    {section("Archived observations", observations.isLoading, observationRows, "No archived observations.", (row) => (
      <li key={`obs-${row.id}`} className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{String(row.referenceNumber ?? "")} · {String(row.title ?? "")}</p>
          <p className="text-xs text-muted-foreground">Archived {formatDate(row.archivedAt)}</p>
        </div>
        <button type="button" disabled={busy}
          onClick={() => restoreObservation.mutate({ id: row.id as number })}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">
          <ArchiveRestore className="h-4 w-4" /> Restore
        </button>
      </li>
    ))}
    {section("Archived tasks", actions.isLoading, actionRows, "No archived tasks.", (row) => (
      <li key={`act-${row.id}`} className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{String(row.referenceNumber ?? "")} · {String(row.title ?? "")}</p>
          <p className="text-xs text-muted-foreground">
            Archived {formatDate(row.archivedAt)}{row.observationRef ? ` · linked to ${String(row.observationRef)}` : ""}
          </p>
        </div>
        <button type="button" disabled={busy}
          onClick={() => restoreAction.mutate({ id: row.id as number })}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">
          <ArchiveRestore className="h-4 w-4" /> Restore
        </button>
      </li>
    ))}
  </div>;
}
