import React, { useState } from "react"
import { useListUsers, useUpdateUser, useCreateUser, getListUsersQueryKey } from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Plus, Search, MoreHorizontal, User as UserIcon } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { getInitials, formatShortDate } from "@/lib/utils"

export default function Users() {
  const { data: users, isLoading } = useListUsers()
  const updateUser = useUpdateUser()
  const createUser = useCreateUser()
  const queryClient = useQueryClient()
  
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [formData, setFormData] = useState({ name: "", email: "", role: "team_member" as any, password: "" })

  if (isLoading || !users) return <div className="p-12 flex justify-center"><div className="animate-pulse h-8 w-8 bg-primary rounded-full"></div></div>

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage estate staff accounts</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search users..." 
          className="pl-9 bg-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground border-b uppercase tracking-wider text-[10px] font-semibold">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 hidden sm:table-cell">Last Login</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredUsers.map(user => (
              <tr key={user.id} className={`hover:bg-muted/30 transition-colors ${!user.active ? 'opacity-60' : ''}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                      {getInitials(user.name)}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{user.name}</div>
                      <div className="text-muted-foreground text-xs">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge variant="outline" className="capitalize bg-white">{user.role.replace('_', ' ')}</Badge>
                </td>
                <td className="px-6 py-4">
                  {user.active ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-slate-50 text-slate-500">Disabled</Badge>
                  )}
                </td>
                <td className="px-6 py-4 hidden sm:table-cell text-muted-foreground">
                  {user.lastLoginAt ? formatShortDate(user.lastLoginAt) : 'Never'}
                </td>
                <td className="px-6 py-4 text-right">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs"
                    onClick={() => handleToggleActive(user.id, user.active)}
                  >
                    {user.active ? 'Disable' : 'Enable'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Full Name</label>
              <Input value={formData.name} onChange={e => setFormData(d => ({ ...d, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={formData.email} onChange={e => setFormData(d => ({ ...d, email: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.role}
                onChange={e => setFormData(d => ({ ...d, role: e.target.value as any }))}
              >
                <option value="team_member">Team Member</option>
                <option value="manager">Manager</option>
                <option value="administrator">Administrator</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Initial Password</label>
              <Input type="password" value={formData.password} onChange={e => setFormData(d => ({ ...d, password: e.target.value }))} required />
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createUser.isPending}>Add User</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
