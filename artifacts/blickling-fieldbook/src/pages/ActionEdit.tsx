import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { getGetActionQueryKey, getListActionsQueryKey, useGetAction, useListAssignees, useUpdateAction } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function ActionEdit() {
  const { id } = useParams<{ id: string }>();
  const numericId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: action, isLoading, error } = useGetAction(numericId);
  const { data: assignees = [] } = useListAssignees();
  const update = useUpdateAction();
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", assignedToUserId: "", priority: "normal", dueDate: "",
    estimatedMinutes: "", equipmentRequired: false, contractorRequired: false });
  useEffect(() => {
    if (!action) return;
    setForm({ title: action.title, description: action.description ?? "", assignedToUserId: String(action.assignedToUserId ?? ""),
      priority: action.priority, dueDate: action.dueDate ? String(action.dueDate).slice(0, 10) : "",
      estimatedMinutes: action.estimatedMinutes == null ? "" : String(action.estimatedMinutes),
      equipmentRequired: action.equipmentRequired ?? false, contractorRequired: action.contractorRequired ?? false });
  }, [action]);
  if (isLoading) return <p role="status">Loading action…</p>;
  if (error || !action) return <div role="alert" className="rounded-md border border-destructive/30 p-4">Action could not be loaded.</div>;
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setMessage(null);
    update.mutate({ id: numericId, data: { title: form.title, description: form.description || null,
      assignedToUserId: Number(form.assignedToUserId), priority: form.priority as typeof action.priority,
      dueDate: form.dueDate || null, estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : null,
      equipmentRequired: form.equipmentRequired, contractorRequired: form.contractorRequired,
      // Optimistic concurrency: a concurrent edit by someone else returns 409.
      expectedUpdatedAt: action.updatedAt ? new Date(action.updatedAt).toISOString() : undefined } }, {
      onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: getGetActionQueryKey(numericId) }),
        queryClient.invalidateQueries({ queryKey: getListActionsQueryKey() })]); setLocation(`/actions/${numericId}`); },
      onError: (err) => setMessage(err instanceof Error ? err.message : "Update failed."),
    });
  };
  const input = "w-full rounded-md border bg-background px-3 py-2";
  return <div className="max-w-2xl space-y-5"><div><h1 className="text-2xl font-bold">Edit {action.referenceNumber}</h1><p className="text-sm text-muted-foreground">Reassign or update the work specification.</p></div>
    <form onSubmit={submit} className="rounded-xl border bg-card p-5 space-y-4">
      <div><label htmlFor="action-edit-title" className="block text-sm font-medium mb-1">Title</label><input id="action-edit-title" required maxLength={200} className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div><label htmlFor="action-edit-description" className="block text-sm font-medium mb-1">Description</label><textarea id="action-edit-description" maxLength={10000} className={`${input} min-h-28`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label htmlFor="action-edit-assignee" className="block text-sm font-medium mb-1">Assigned to</label><select id="action-edit-assignee" required className={input} value={form.assignedToUserId} onChange={(e) => setForm({ ...form, assignedToUserId: e.target.value })}><option value="">Select staff member</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div>
        <div><label htmlFor="action-edit-priority" className="block text-sm font-medium mb-1">Priority</label><select id="action-edit-priority" className={input} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{["low", "normal", "high", "urgent"].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
        <div><label htmlFor="action-edit-due" className="block text-sm font-medium mb-1">Due date</label><input id="action-edit-due" type="date" className={input} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
        <div><label htmlFor="action-edit-minutes" className="block text-sm font-medium mb-1">Estimated minutes</label><input id="action-edit-minutes" type="number" min={0} max={525600} className={input} value={form.estimatedMinutes} onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })} /></div>
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.equipmentRequired} onChange={(e) => setForm({ ...form, equipmentRequired: e.target.checked })} />Specialist equipment required</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.contractorRequired} onChange={(e) => setForm({ ...form, contractorRequired: e.target.checked })} />External contractor required</label>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="rounded-md border px-4 py-2" onClick={() => setLocation(`/actions/${numericId}`)}>Cancel</button><button disabled={update.isPending} className="rounded-md bg-primary text-primary-foreground px-4 py-2 disabled:opacity-60">{update.isPending ? "Saving…" : "Save changes"}</button></div>
    </form></div>;
}
