import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { getGetObservationQueryKey, getListObservationsQueryKey, useGetObservation, useListCategories, useListLocations, useUpdateObservation } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const localDateTime = (value: string | Date) => {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export default function ObservationEdit() {
  const { id } = useParams<{ id: string }>();
  const numericId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: observation, isLoading, error } = useGetObservation(numericId);
  const { data: categories = [] } = useListCategories();
  const { data: locations = [] } = useListLocations();
  const update = useUpdateObservation();
  const [form, setForm] = useState({ title: "", description: "", categoryId: "", priority: "normal", observedAt: "",
    namedLocationId: "", latitude: "", longitude: "", safetyIssue: false, publicAccessAffected: false,
    machineryRequired: false, specialistRequired: false, followUpRequired: false });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!observation) return;
    setForm({ title: observation.title, description: observation.description ?? "", categoryId: String(observation.categoryId ?? ""),
      priority: observation.priority, observedAt: localDateTime(observation.observedAt ?? observation.createdAt), namedLocationId: String(observation.namedLocationId ?? ""),
      latitude: observation.latitude == null ? "" : String(observation.latitude), longitude: observation.longitude == null ? "" : String(observation.longitude),
      safetyIssue: observation.safetyIssue ?? false, publicAccessAffected: observation.publicAccessAffected ?? false,
      machineryRequired: observation.machineryRequired ?? false, specialistRequired: observation.specialistRequired ?? false,
      followUpRequired: observation.followUpRequired ?? false });
  }, [observation]);

  if (isLoading) return <p role="status">Loading observation…</p>;
  if (error || !observation) return <div role="alert" className="rounded-md border border-destructive/30 p-4">Observation could not be loaded.</div>;

  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setMessage(null);
    const latitude = form.latitude === "" ? null : Number(form.latitude);
    const longitude = form.longitude === "" ? null : Number(form.longitude);
    update.mutate({ id: numericId, data: {
      title: form.title, description: form.description || null, categoryId: Number(form.categoryId),
      priority: form.priority as typeof observation.priority, observedAt: new Date(form.observedAt).toISOString(),
      namedLocationId: form.namedLocationId ? Number(form.namedLocationId) : null,
      latitude, longitude,
      safetyIssue: form.safetyIssue, publicAccessAffected: form.publicAccessAffected,
      machineryRequired: form.machineryRequired, specialistRequired: form.specialistRequired, followUpRequired: form.followUpRequired,
    } }, { onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: getGetObservationQueryKey(numericId) }),
        queryClient.invalidateQueries({ queryKey: getListObservationsQueryKey() })]);
      setLocation(`/observations/${numericId}`);
    }, onError: (err) => setMessage(err instanceof Error ? err.message : "Update failed.") });
  };

  const input = "w-full rounded-md border bg-background px-3 py-2";
  return <div className="max-w-2xl space-y-5">
    <div><h1 className="text-2xl font-bold">Edit {observation.referenceNumber}</h1><p className="text-sm text-muted-foreground">Changes are retained in the audit history.</p></div>
    <form onSubmit={submit} className="rounded-xl border bg-card p-5 space-y-4">
      <div><label htmlFor="edit-title" className="block text-sm font-medium mb-1">Title</label><input id="edit-title" required maxLength={200} className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div><label htmlFor="edit-description" className="block text-sm font-medium mb-1">Description</label><textarea id="edit-description" maxLength={10000} className={`${input} min-h-28`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label htmlFor="edit-category" className="block text-sm font-medium mb-1">Category</label><select id="edit-category" required className={input} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>{categories.filter((item) => item.active || item.id === observation.categoryId).map((item) => <option key={item.id} value={item.id}>{item.name}{item.active ? "" : " (inactive)"}</option>)}</select></div>
        <div><label htmlFor="edit-priority" className="block text-sm font-medium mb-1">Priority</label><select id="edit-priority" className={input} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{["low", "normal", "high", "urgent"].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
        <div><label htmlFor="edit-observed" className="block text-sm font-medium mb-1">Observed at</label><input id="edit-observed" required type="datetime-local" className={input} value={form.observedAt} onChange={(e) => setForm({ ...form, observedAt: e.target.value })} /></div>
        <div><label htmlFor="edit-location" className="block text-sm font-medium mb-1">Named location</label><select id="edit-location" className={input} value={form.namedLocationId} onChange={(e) => setForm({ ...form, namedLocationId: e.target.value })}><option value="">None</option>{locations.filter((item) => item.active || item.id === observation.namedLocationId).map((item) => <option key={item.id} value={item.id}>{item.name}{item.active ? "" : " (inactive)"}</option>)}</select></div>
        <div><label htmlFor="edit-latitude" className="block text-sm font-medium mb-1">Latitude</label><input id="edit-latitude" type="number" step="any" min={-90} max={90} className={input} value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></div>
        <div><label htmlFor="edit-longitude" className="block text-sm font-medium mb-1">Longitude</label><input id="edit-longitude" type="number" step="any" min={-180} max={180} className={input} value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></div>
      </div>
      <fieldset className="grid sm:grid-cols-2 gap-3"><legend className="text-sm font-medium mb-2">Flags</legend>{([
        ["safetyIssue", "Safety issue"], ["publicAccessAffected", "Public access affected"], ["machineryRequired", "Machinery required"],
        ["specialistRequired", "Specialist required"], ["followUpRequired", "Follow-up required"],
      ] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />{label}</label>)}</fieldset>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="rounded-md border px-4 py-2" onClick={() => setLocation(`/observations/${numericId}`)}>Cancel</button><button disabled={update.isPending} className="rounded-md bg-primary text-primary-foreground px-4 py-2 disabled:opacity-60">{update.isPending ? "Saving…" : "Save changes"}</button></div>
    </form>
  </div>;
}
