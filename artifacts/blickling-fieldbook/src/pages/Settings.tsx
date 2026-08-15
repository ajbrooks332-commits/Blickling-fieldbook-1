import { useEffect, useState } from "react";
import { getGetMeQueryKey, useChangePassword, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Database, KeyRound, RefreshCw, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { discardPendingChange, listPendingChanges, retryPendingChange, syncOutbox, type PendingChange } from "@/lib/offline";
import { clearOfflineData, getOfflineMeta, preloadOfflineData, storageEstimate, type OfflineMeta } from "@/lib/offlineStore";

interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

export default function Settings({ forcePasswordChange = false }: { forcePasswordChange?: boolean }) {
  const { data: user } = useGetMe();
  const queryClient = useQueryClient();
  const mutation = useChangePassword();
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [offlineMeta, setOfflineMeta] = useState<OfflineMeta | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [preloading, setPreloading] = useState(false);
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const propertyId = (user as { propertyId?: number } | undefined)?.propertyId ?? 0;
  const refreshOffline = async () => {
    if (!user) return;
    setOfflineMeta(await getOfflineMeta(user.id, propertyId));
    setUsage(await storageEstimate());
  };
  useEffect(() => { void refreshOffline().catch(() => undefined); }, [user?.id]);
  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  const refreshPending = async () => {
    if (user) setPendingChanges(await listPendingChanges(user.id));
  };
  useEffect(() => {
    const refresh = () => { void refreshPending().catch(() => undefined); };
    refresh();
    window.addEventListener("fieldbook-sync", refresh);
    return () => window.removeEventListener("fieldbook-sync", refresh);
  }, [user?.id]);
  const changePassword = (event: React.FormEvent) => {
    event.preventDefault(); setMessage(null);
    if (passwords.newPassword !== passwords.confirm) return setMessage("The new passwords do not match.");
    mutation.mutate({ data: { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword } }, {
      onSuccess: async () => {
        setPasswords({ currentPassword: "", newPassword: "", confirm: "" }); setMessage("Password changed successfully.");
        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
      onError: (error) => setMessage(error instanceof Error ? error.message : "Password change failed."),
    });
  };
  return <div className="max-w-2xl space-y-6">
    <div><h1 className="text-2xl font-bold">Settings</h1><p className="text-sm text-muted-foreground">Security and installation settings for {user?.name}.</p></div>
    {forcePasswordChange && <div role="alert" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm">Change your temporary password before using the rest of Fieldbook.</div>}
    <section className="rounded-xl border bg-card p-5 space-y-4" aria-labelledby="password-title">
      <div className="flex gap-3"><KeyRound className="text-primary" aria-hidden="true" /><div><h2 id="password-title" className="font-semibold">Change password</h2><p className="text-sm text-muted-foreground">Use at least 14 characters with upper/lowercase, a number and symbol.</p></div></div>
      <form onSubmit={changePassword} className="space-y-3">
        {([["Current password", "currentPassword"], ["New password", "newPassword"], ["Confirm new password", "confirm"]] as const).map(([label, key]) => <div key={key}>
          <label htmlFor={`password-${key}`} className="block text-sm font-medium mb-1">{label}</label>
          <input id={`password-${key}`} type="password" required value={passwords[key]} onChange={(e) => setPasswords((old) => ({ ...old, [key]: e.target.value }))}
            autoComplete={key === "currentPassword" ? "current-password" : "new-password"} className="w-full rounded-md border bg-background px-3 py-2" />
        </div>)}
        {message && <p role="status" className="text-sm">{message}</p>}
        <button disabled={mutation.isPending} className="rounded-md bg-primary text-primary-foreground px-4 py-2 disabled:opacity-60">Change password</button>
      </form>
    </section>
    {!forcePasswordChange && <section className="rounded-xl border bg-card p-5 space-y-3" aria-labelledby="install-title">
      <div className="flex gap-3"><Smartphone className="text-primary" aria-hidden="true" /><div><h2 id="install-title" className="font-semibold">Install Fieldbook</h2><p className="text-sm text-muted-foreground">Install it on this device for offline access and queued field records.</p></div></div>
      <button disabled={!installPrompt} onClick={async () => { if (installPrompt) { await installPrompt.prompt(); setInstallPrompt(null); } }}
        className="rounded-md border px-4 py-2 disabled:opacity-50">{installPrompt ? "Install app" : "Already installed or installation unavailable"}</button>
    </section>}
    {!forcePasswordChange && <section className="rounded-xl border bg-card p-5 space-y-3" aria-labelledby="offline-title">
      <div className="flex gap-3"><Database className="text-primary" aria-hidden="true" /><div><h2 id="offline-title" className="font-semibold">Offline data</h2>
        <p className="text-sm text-muted-foreground">Download the estate dataset to this device so Fieldbook works without signal.</p></div></div>
      {offlineMeta?.complete ? <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm space-y-1">
        <p className="font-medium">Ready for offline use</p>
        <p className="text-xs text-muted-foreground">Last successful sync {new Date(offlineMeta.lastSyncAt).toLocaleString("en-GB")} · data age {Math.max(0, Math.round((Date.now() - Date.parse(offlineMeta.lastSyncAt)) / 3_600_000))}h</p>
        <p className="text-xs text-muted-foreground">
          {Object.entries(offlineMeta.counts).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(" · ") || "No records"}
        </p>
        {usage && <p className="text-xs text-muted-foreground">Local storage: ~{(usage.usage / 1_048_576).toFixed(1)} MB used of {(usage.quota / 1_048_576).toFixed(0)} MB available{usage.quota > 0 && usage.usage / usage.quota > 0.8 ? " — storage is nearly full; clear space or offline data may be evicted." : ""}</p>}
      </div> : <p className="text-sm text-muted-foreground">No offline dataset downloaded yet on this device.</p>}
      {offlineMessage && <p role="status" className="text-sm">{offlineMessage}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={preloading || !navigator.onLine || !user} onClick={async () => {
          if (!user) return;
          setPreloading(true); setOfflineMessage(null);
          try { await preloadOfflineData(user.id, propertyId); setOfflineMessage("Offline dataset downloaded — ready for offline use."); await refreshOffline(); }
          catch { setOfflineMessage("Could not download the offline dataset. Check your connection and try again."); }
          finally { setPreloading(false); }
        }} className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${preloading ? "animate-spin motion-reduce:animate-none" : ""}`} />{preloading ? "Downloading…" : offlineMeta?.complete ? "Refresh offline data" : "Download for offline use"}</button>
        <button type="button" disabled={!offlineMeta?.complete || !user} onClick={async () => {
          if (!user) return;
          const warning = pendingChanges.length > 0
            ? `You still have ${pendingChanges.length} unsynced change(s) queued on this phone — they will NOT be deleted, only the downloaded dataset. Continue?`
            : "Remove the downloaded estate dataset from this phone? Server records are not affected.";
          if (!window.confirm(warning)) return;
          await clearOfflineData(user.id, propertyId); setOfflineMessage("Offline data cleared from this phone."); await refreshOffline();
        }} className="rounded-md border px-4 py-2 text-destructive disabled:opacity-50">Clear offline data from this phone</button>
      </div>
    </section>}
    {!forcePasswordChange && <section className="rounded-xl border bg-card p-5 space-y-3" aria-labelledby="byod-title">
      <div className="flex gap-3"><ShieldCheck className="text-primary" aria-hidden="true" /><div><h2 id="byod-title" className="font-semibold">Using your own phone</h2>
        <p className="text-sm text-muted-foreground">Fieldbook stores estate data on this device while offline. Please:</p></div></div>
      <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
        <li>Use a PIN or biometric lock on this phone.</li>
        <li>Keep the phone's software up to date.</li>
        <li>Do not share your Fieldbook account with anyone.</li>
        <li>Report a lost or stolen phone to a manager immediately so your session can be revoked.</li>
        <li>Do not record personal, visitor or other sensitive information — Fieldbook is for estate condition and work records only.</li>
      </ul>
    </section>}
    {!forcePasswordChange && <section className="rounded-xl border bg-card p-5 space-y-3" aria-labelledby="queue-title">
      <div><h2 id="queue-title" className="font-semibold">Queued field changes</h2><p className="text-sm text-muted-foreground">Changes saved without a reliable connection remain on this device until they sync.</p></div>
      {pendingChanges.length === 0 ? <p className="text-sm text-muted-foreground">No changes are waiting to sync.</p> : <div className="space-y-2">
        {pendingChanges.map((change) => <div key={change.id} className="rounded-md border p-3 text-sm">
          <div className="flex items-start justify-between gap-3"><div><p className="font-medium capitalize">{change.kind} change{change.quarantined ? " — needs attention" : ""}</p>
            <p className="text-xs text-muted-foreground">Queued {new Date(change.createdAt).toLocaleString("en-GB")}{change.quarantined ? " · paused so it does not block other changes" : ""}</p>
            {change.lastError && <p role="alert" className="mt-1 text-xs text-destructive">Sync needs attention: {change.lastError}</p>}</div>
            <div className="flex gap-2">
              {change.quarantined && <button type="button" aria-label="Retry queued change" className="rounded-md border p-2" onClick={async () => {
                if (!user) return;
                await retryPendingChange(change.id, user.id); await refreshPending();
                setQueueMessage("Change will be retried on the next sync.");
              }}><RefreshCw className="h-4 w-4" /></button>}
              <button type="button" aria-label="Discard queued change" className="rounded-md border p-2 text-destructive" onClick={async () => {
                if (!user || !window.confirm("Discard this queued change? This cannot be undone.")) return;
                await discardPendingChange(change.id, user.id); await refreshPending();
              }}><Trash2 className="h-4 w-4" /></button>
            </div></div>
        </div>)}
      </div>}
      {queueMessage && <p role="status" className="text-sm">{queueMessage}</p>}
      <button type="button" disabled={syncing || !navigator.onLine || pendingChanges.length === 0} onClick={async () => {
        setSyncing(true); setQueueMessage(null);
        try { const result = await syncOutbox(); setQueueMessage(result.remaining ? `${result.remaining} change(s) still need attention.` : "All queued changes synced."); await refreshPending(); }
        catch { setQueueMessage("Queued changes could not be synced right now."); }
        finally { setSyncing(false); }
      }} className="inline-flex items-center gap-2 rounded-md border px-4 py-2 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin motion-reduce:animate-none" : ""}`} />{syncing ? "Syncing…" : "Retry sync"}</button>
    </section>}
  </div>;
}
