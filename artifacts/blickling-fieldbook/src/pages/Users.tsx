import React, { useState } from "react"
import { useListUsers, useUpdateUser, useCreateUser, getListUsersQueryKey } from "@workspace/api-client-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Plus, Search, User as UserIcon } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { getInitials, formatShortDate } from "@/lib/utils"

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
}

const HEAD = { fontFamily: "'Space Grotesk', sans-serif" }
const BODY = { fontFamily: "'Inter', sans-serif" }

function roleColor(role: string) {
  if (role === "administrator") return { color: C.emerald, bg: "rgba(16,185,129,0.12)" }
  if (role === "manager") return { color: "#58a6ff", bg: "rgba(88,166,255,0.12)" }
  return { color: C.muted, bg: "rgba(139,148,158,0.12)" }
}

export default function Users() {
  const { data: users, isLoading } = useListUsers()
  const updateUser = useUpdateUser()
  const createUser = useCreateUser()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [formData, setFormData] = useState({ name: "", email: "", role: "team_member" as any, password: "" })

  if (isLoading || !users) {
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

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleToggleActive = (id: number, active: boolean) => {
    updateUser.mutate(
      { id, data: { active: !active } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }) }
    )
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    createUser.mutate(
      { data: formData },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() })
          setCreateOpen(false)
          setFormData({ name: "", email: "", role: "team_member", password: "" })
        }
      }
    )
  }

  const inputStyle = {
    background: C.bg,
    border: `1px solid ${C.border}`,
    color: C.text,
    borderRadius: "0.625rem",
    padding: "0.5rem 0.75rem",
    fontSize: 13,
    ...BODY,
    outline: "none",
    width: "100%",
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 style={{ ...HEAD, fontSize: 22, fontWeight: 700, color: C.text }}>Users</h1>
          <p style={{ ...BODY, fontSize: 13, color: C.muted, marginTop: 2 }}>Manage estate staff accounts</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: C.emerald, color: "#fff", border: "none", ...HEAD }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = C.emeraldDark}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = C.emerald}
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.dim }} />
        <input
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, paddingLeft: "2.25rem" }}
          onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.emerald}
          onBlur={e => (e.target as HTMLInputElement).style.borderColor = C.border}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <table className="w-full text-sm text-left">
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["User", "Role", "Status", "Last Login", "Actions"].map((h, i) => (
                <th
                  key={h}
                  className={`px-6 py-4 ${i === 3 ? "hidden sm:table-cell" : ""} ${i === 4 ? "text-right" : ""}`}
                  style={{ ...HEAD, fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user, idx) => {
              const rc = roleColor(user.role)
              return (
                <tr
                  key={user.id}
                  style={{
                    borderBottom: idx < filteredUsers.length - 1 ? `1px solid ${C.borderMid}` : "none",
                    opacity: user.active ? 1 : 0.5,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0"
                        style={{ background: C.emeraldTint, color: C.emerald, ...HEAD }}
                      >
                        {getInitials(user.name)}
                      </div>
                      <div>
                        <div style={{ ...HEAD, fontWeight: 600, color: C.text, fontSize: 13 }}>{user.name}</div>
                        <div style={{ ...BODY, color: C.muted, fontSize: 12 }}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="capitalize"
                      style={{
                        ...HEAD,
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 9999,
                        padding: "2px 8px",
                        background: rc.bg,
                        color: rc.color,
                      }}
                    >
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      style={{
                        ...HEAD,
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 9999,
                        padding: "2px 8px",
                        background: user.active ? "rgba(16,185,129,0.12)" : "rgba(72,79,88,0.2)",
                        color: user.active ? C.emerald : C.dim,
                      }}
                    >
                      {user.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell" style={{ ...BODY, color: C.muted, fontSize: 13 }}>
                    {user.lastLoginAt ? formatShortDate(user.lastLoginAt) : "Never"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleToggleActive(user.id, user.active)}
                      className="text-xs px-3 py-1.5 rounded-lg"
                      style={{
                        ...HEAD,
                        background: "transparent",
                        border: `1px solid ${C.border}`,
                        color: C.muted,
                        cursor: "pointer",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.borderMid; (e.currentTarget as HTMLButtonElement).style.color = C.text }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = C.muted }}
                    >
                      {user.active ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              )
            })}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <UserIcon className="w-8 h-8 mx-auto mb-2" style={{ color: C.dim }} />
                  <p style={{ ...BODY, color: C.muted, fontSize: 13 }}>No users found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text }}>
          <DialogHeader>
            <DialogTitle style={{ ...HEAD, color: C.text }}>Add New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            {[
              { label: "Full Name", key: "name", type: "text" },
              { label: "Email", key: "email", type: "email" },
              { label: "Initial Password", key: "password", type: "password" },
            ].map(({ label, key, type }) => (
              <div key={key} className="space-y-1.5">
                <label style={{ ...HEAD, fontSize: 12, fontWeight: 600, color: C.muted }}>{label}</label>
                <input
                  type={type}
                  value={(formData as any)[key]}
                  onChange={e => setFormData(d => ({ ...d, [key]: e.target.value }))}
                  required
                  style={inputStyle}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.emerald}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = C.border}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <label style={{ ...HEAD, fontSize: 12, fontWeight: 600, color: C.muted }}>Role</label>
              <select
                value={formData.role}
                onChange={e => setFormData(d => ({ ...d, role: e.target.value as any }))}
                style={{ ...inputStyle }}
                onFocus={e => (e.target as HTMLSelectElement).style.borderColor = C.emerald}
                onBlur={e => (e.target as HTMLSelectElement).style.borderColor = C.border}
              >
                <option value="team_member">Team Member</option>
                <option value="manager">Manager</option>
                <option value="administrator">Administrator</option>
              </select>
            </div>
            <DialogFooter className="mt-6 gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, ...HEAD }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createUser.isPending}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: C.emerald, color: "#fff", border: "none", ...HEAD, opacity: createUser.isPending ? 0.6 : 1 }}
              >
                {createUser.isPending ? "Adding…" : "Add User"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
