import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getGetSetupStatusQueryKey, useCompleteSetup } from "@workspace/api-client-react";
import { ShieldCheck } from "lucide-react";

export default function Setup() {
  const queryClient = useQueryClient();
  const setup = useCompleteSetup();
  const [form, setForm] = useState({ setupSecret: "", name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (form.password !== form.confirm) return setError("The passwords do not match.");
    setup.mutate({ data: { setupSecret: form.setupSecret, name: form.name, email: form.email, password: form.password } }, {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetSetupStatusQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }),
        ]);
        window.location.replace("/");
      },
      onError: (err) => setError(err instanceof Error ? err.message : "Setup could not be completed."),
    });
  };

  const fields = [
    ["Setup secret", "setupSecret", "password", "The value stored as SETUP_SECRET in Replit Secrets"],
    ["Your name", "name", "text", "Countryside Manager"],
    ["Email", "email", "email", "name@example.org"],
    ["Password", "password", "password", "At least 14 characters, with upper/lowercase, a number and symbol"],
    ["Confirm password", "confirm", "password", "Repeat the password"],
  ] as const;

  return <main className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
    <section className="w-full max-w-md rounded-xl border bg-card p-6 space-y-5" aria-labelledby="setup-title">
      <div className="flex items-center gap-3"><ShieldCheck className="w-9 h-9 text-primary" aria-hidden="true" />
        <div><h1 id="setup-title" className="text-2xl font-bold">Secure initial setup</h1><p className="text-sm text-muted-foreground">Create the first Blickling administrator.</p></div>
      </div>
      <p className="text-sm text-muted-foreground">This one-time screen replaces every committed/default account. Existing test users will be disabled and all sessions revoked.</p>
      <form onSubmit={submit} className="space-y-4">
        {fields.map(([label, key, type, hint]) => <div key={key}>
          <label htmlFor={`setup-${key}`} className="block text-sm font-medium mb-1">{label}</label>
          <input id={`setup-${key}`} type={type} value={form[key]} onChange={(e) => setForm((old) => ({ ...old, [key]: e.target.value }))}
            required autoComplete={key === "email" ? "email" : key.includes("password") || key === "confirm" ? "new-password" : "off"}
            className="w-full rounded-md border bg-background px-3 py-2" aria-describedby={`setup-${key}-hint`} />
          <p id={`setup-${key}-hint`} className="text-xs text-muted-foreground mt-1">{hint}</p>
        </div>)}
        {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <button type="submit" disabled={setup.isPending} className="w-full rounded-md bg-primary text-primary-foreground py-2.5 font-medium disabled:opacity-60">
          {setup.isPending ? "Securing Fieldbook…" : "Create administrator"}
        </button>
      </form>
    </section>
  </main>;
}
