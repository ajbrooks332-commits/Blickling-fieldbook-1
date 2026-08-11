import { useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getListUsersQueryKey, useCreateUser, useListUsers, useUpdateUser, type User } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Search, User as UserIcon } from "lucide-react"
import { formatShortDate, getInitials } from "@/lib/utils"

type Role = User["role"]
type UserForm = { name: string; email: string; role: Role; active: boolean; password: string }
const emptyForm: UserForm = { name: "", email: "", role: "team_member", active: true, password: "" }
const inputClass = "w-full rounded-md border bg-background px-3 py-2 text-sm"

export default function Users() {
  const { data: users, isLoading, error: loadError } = useListUsers()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [requestError, setRequestError] = useState<string | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() })
  const openCreate = () => { setEditingId(null); setForm(emptyForm); setRequestError(null); setDialogOpen(true) }
  const openEdit = (user: User) => {
    setEditingId(user.id)
    setForm({ name: user.name, email: user.email, role: user.role, active: user.active, password: "" })
    setRequestError(null); setDialogOpen(true)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setRequestError(null)
    try {
      if (editingId) {
        await updateUser.mutateAsync({ id: editingId, data: {
          name: form.name.trim(), email: form.email.trim().toLowerCase(), role: form.role, active: form.active,
          ...(form.password ? { password: form.password } : {}),
        } })
      } else {
        await createUser.mutateAsync({ data: {
          name: form.name.trim(), email: form.email.trim().toLowerCase(), role: form.role, password: form.password,
        } })
      }
      await refresh(); setDialogOpen(false); setForm(emptyForm)
    } catch (error) { setRequestError(error instanceof Error ? error.message : "User could not be saved.") }
  }

  const toggleActive = async (user: User) => {
    setRequestError(null)
    try { await updateUser.mutateAsync({ id: user.id, data: { active: !user.active } }); await refresh() }
    catch (error) { setRequestError(error instanceof Error ? error.message : "User status could not be changed.") }
  }

  if (isLoading) return <p role="status" className="py-12 text-center text-muted-foreground">Loading users…</p>
  if (loadError || !users) return <div role="alert" className="rounded-md border border-destructive/30 p-4">Users could not be loaded.</div>

  const needle = search.trim().toLowerCase()
  const filtered = users.filter((user) => !needle || user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle))
  const saving = createUser.isPending || updateUser.isPending

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-bold">Users</h1><p className="text-sm text-muted-foreground">Manage estate staff accounts and permissions.</p></div>
      <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground"><Plus className="h-4 w-4" /> Add user</button>
    </div>

    {requestError && !dialogOpen && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{requestError}</p>}
    <div className="relative max-w-md"><label htmlFor="user-search" className="sr-only">Search users</label><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input id="user-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users…" className={`${inputClass} pl-9`} /></div>

    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
        <th className="px-5 py-3">User</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Last login</th><th className="px-5 py-3 text-right">Actions</th>
      </tr></thead><tbody>{filtered.map((user) => <tr key={user.id} className="border-b last:border-b-0">
        <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{getInitials(user.name)}</span>
          <span><span className="block font-medium">{user.name}</span><span className="block text-xs text-muted-foreground">{user.email}</span></span></div></td>
        <td className="px-5 py-4 capitalize">{user.role.replace("_", " ")}</td>
        <td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs ${user.active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{user.active ? "Active" : "Disabled"}</span></td>
        <td className="px-5 py-4 text-muted-foreground">{user.lastLoginAt ? formatShortDate(user.lastLoginAt) : "Never"}</td>
        <td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(user)} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</button>
          <button type="button" disabled={saving} onClick={() => void toggleActive(user)} className="rounded-md border px-3 py-1.5 disabled:opacity-60">{user.active ? "Disable" : "Enable"}</button></div></td>
      </tr>)}{filtered.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground"><UserIcon className="mx-auto mb-2 h-8 w-8" />No users found.</td></tr>}</tbody></table>
    </div>

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><DialogHeader><DialogTitle>{editingId ? "Edit user" : "Add user"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div><label htmlFor="user-name" className="mb-1 block text-sm font-medium">Full name</label><input id="user-name" required minLength={2} maxLength={120} className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
        <div><label htmlFor="user-email" className="mb-1 block text-sm font-medium">Email</label><input id="user-email" required type="email" maxLength={254} autoComplete="email" className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
        <div><label htmlFor="user-role" className="mb-1 block text-sm font-medium">Role</label><select id="user-role" className={inputClass} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
          <option value="team_member">Team member</option><option value="manager">Manager</option><option value="administrator">Administrator</option></select></div>
        <div><label htmlFor="user-password" className="mb-1 block text-sm font-medium">{editingId ? "New password (leave blank to keep current)" : "Initial password"}</label>
          <input id="user-password" type="password" required={!editingId} minLength={14} maxLength={128} autoComplete="new-password" className={inputClass} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          <p className="mt-1 text-xs text-muted-foreground">At least 14 characters with upper- and lower-case letters, a number and a symbol. The user must change it at first login.</p></div>
        {editingId && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Account active</label>}
        {requestError && <p role="alert" className="text-sm text-destructive">{requestError}</p>}
        <DialogFooter><button type="button" onClick={() => setDialogOpen(false)} className="rounded-md border px-4 py-2">Cancel</button><button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60">{saving ? "Saving…" : "Save user"}</button></DialogFooter>
      </form></DialogContent></Dialog>
  </div>
}
