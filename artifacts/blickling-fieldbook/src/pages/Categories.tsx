import React, { useState } from "react"
import {
  useListCategories,
  useCreateCategory,
  useUpdateCategory,
  getListCategoriesQueryKey,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Plus, Tag, Pencil, Check, X } from "lucide-react"

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
  emeraldTint: "rgba(16,185,129,0.08)",
}

const HEAD = { fontFamily: "'Space Grotesk', sans-serif" }
const BODY = { fontFamily: "'Inter', sans-serif" }

const inputStyle: React.CSSProperties = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  color: C.text,
  borderRadius: "0.625rem",
  padding: "0.4rem 0.75rem",
  fontSize: 13,
  outline: "none",
  ...BODY,
}

const PRESET_COLOURS = [
  "#10b981", "#58a6ff", "#f85149", "#d29922", "#a78bfa",
  "#34d399", "#fb923c", "#e879f9", "#38bdf8", "#818cf8",
]

interface EditRowState {
  name: string
  description: string
  displayColour: string
}

export default function Categories() {
  const { data: categories, isLoading, error: loadError } = useListCategories()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const queryClient = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [newForm, setNewForm] = useState<EditRowState>({ name: "", description: "", displayColour: "#10b981" })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EditRowState>({ name: "", description: "", displayColour: "#10b981" })
  const [requestError, setRequestError] = useState<string | null>(null)

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
  if (loadError || !categories) return <div role="alert" className="rounded-md border border-destructive/30 p-4">Categories could not be loaded.</div>

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setRequestError(null)
    if (!newForm.name.trim()) return
    createCategory.mutate(
      { data: { name: newForm.name, description: newForm.description || undefined, displayColour: newForm.displayColour } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() })
          setCreateOpen(false)
          setNewForm({ name: "", description: "", displayColour: "#10b981" })
        }, onError: (error) => setRequestError(error instanceof Error ? error.message : "Category could not be created."),
      }
    )
  }

  const startEdit = (cat: typeof categories[0]) => {
    setEditingId(cat.id)
    setEditForm({
      name: cat.name,
      description: cat.description || "",
      displayColour: cat.displayColour || "#10b981",
    })
  }

  const handleUpdate = (id: number) => {
    setRequestError(null)
    updateCategory.mutate(
      { id, data: { name: editForm.name, description: editForm.description || null, displayColour: editForm.displayColour } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() })
          setEditingId(null)
        }, onError: (error) => setRequestError(error instanceof Error ? error.message : "Category could not be updated."),
      }
    )
  }

  const handleToggleActive = (id: number, active: boolean) => {
    setRequestError(null)
    updateCategory.mutate(
      { id, data: { active: !active } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() }),
        onError: (error) => setRequestError(error instanceof Error ? error.message : "Category status could not be changed.") }
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 style={{ ...HEAD, fontSize: 22, fontWeight: 700, color: C.text }}>Category Management</h1>
          <p style={{ ...BODY, fontSize: 13, color: C.muted, marginTop: 2 }}>Organise observations by type</p>
        </div>
        <button
          onClick={() => setCreateOpen(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
          style={{ background: C.emerald, color: "#fff", border: "none", ...HEAD, fontWeight: 600, cursor: "pointer" }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = C.emeraldDark}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = C.emerald}
        >
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>
      {requestError && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{requestError}</p>}

      {/* Create form */}
      {createOpen && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl p-5 space-y-4"
          style={{ background: C.surface, border: `1px solid ${C.emerald}` }}
        >
          <h2 style={{ ...HEAD, fontSize: 14, fontWeight: 600, color: C.text }}>New Category</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="new-category-name" style={{ ...HEAD, fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Name *</label>
              <input
                id="new-category-name" maxLength={120}
                value={newForm.name}
                onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                required
                placeholder="e.g. Woodland"
                style={{ ...inputStyle, width: "100%" }}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.emerald}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = C.border}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="new-category-description" style={{ ...HEAD, fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</label>
              <input
                id="new-category-description" maxLength={1000}
                value={newForm.description}
                onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                style={{ ...inputStyle, width: "100%" }}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.emerald}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = C.border}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="new-category-colour" style={{ ...HEAD, fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Colour</label>
            <div className="flex flex-wrap gap-2 items-center">
              {PRESET_COLOURS.map(col => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setNewForm(f => ({ ...f, displayColour: col }))}
                  className="w-6 h-6 rounded-full transition-transform"
                  style={{
                    background: col,
                    border: newForm.displayColour === col ? `2px solid ${C.text}` : `2px solid transparent`,
                    transform: newForm.displayColour === col ? "scale(1.25)" : "scale(1)",
                    cursor: "pointer",
                  }}
                />
              ))}
              <input
                id="new-category-colour" aria-label="Custom category colour"
                type="color"
                value={newForm.displayColour}
                onChange={e => setNewForm(f => ({ ...f, displayColour: e.target.value }))}
                style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${C.border}`, background: "none", cursor: "pointer", padding: 0 }}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, ...HEAD, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createCategory.isPending}
              className="px-4 py-1.5 rounded-lg text-sm"
              style={{ background: C.emerald, color: "#fff", border: "none", ...HEAD, cursor: "pointer", opacity: createCategory.isPending ? 0.6 : 1 }}
            >
              {createCategory.isPending ? "Saving…" : "Save Category"}
            </button>
          </div>
        </form>
      )}

      {/* Category list */}
      <div className="rounded-xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#21262d" }}>
              <Tag className="w-6 h-6" style={{ color: C.dim }} />
            </div>
            <p style={{ ...BODY, color: C.muted, fontSize: 14 }}>No categories yet</p>
          </div>
        ) : (
          categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="px-5 py-4"
              style={{
                borderBottom: idx < categories.length - 1 ? `1px solid ${C.borderMid}` : "none",
                opacity: cat.active ? 1 : 0.5,
              }}
            >
              {editingId === cat.id ? (
                /* Edit inline */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      style={{ ...inputStyle, width: "100%" }}
                      onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.emerald}
                      onBlur={e => (e.target as HTMLInputElement).style.borderColor = C.border}
                    />
                    <input
                      value={editForm.description}
                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Description"
                      style={{ ...inputStyle, width: "100%" }}
                      onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.emerald}
                      onBlur={e => (e.target as HTMLInputElement).style.borderColor = C.border}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {PRESET_COLOURS.map(col => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setEditForm(f => ({ ...f, displayColour: col }))}
                        className="w-5 h-5 rounded-full"
                        style={{
                          background: col,
                          border: editForm.displayColour === col ? `2px solid ${C.text}` : `2px solid transparent`,
                          transform: editForm.displayColour === col ? "scale(1.2)" : "scale(1)",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                    <input
                      type="color"
                      value={editForm.displayColour}
                      onChange={e => setEditForm(f => ({ ...f, displayColour: e.target.value }))}
                      style={{ width: 24, height: 24, borderRadius: "50%", border: `1px solid ${C.border}`, background: "none", cursor: "pointer", padding: 0 }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(cat.id)}
                      disabled={updateCategory.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                      style={{ background: C.emerald, color: "#fff", border: "none", ...HEAD, cursor: "pointer" }}
                    >
                      <Check className="w-3.5 h-3.5" /> Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                      style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, ...HEAD, cursor: "pointer" }}
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Display row */
                <div className="flex items-center gap-4">
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ background: cat.displayColour || C.emerald, border: "1px solid rgba(255,255,255,0.15)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span style={{ ...HEAD, fontSize: 14, fontWeight: 600, color: C.text }}>{cat.name}</span>
                      {!cat.active && (
                        <span
                          style={{
                            ...HEAD, fontSize: 10, fontWeight: 600, borderRadius: 9999,
                            padding: "1px 6px", background: "rgba(72,79,88,0.2)", color: C.dim,
                          }}
                        >
                          Inactive
                        </span>
                      )}
                    </div>
                    {cat.description && (
                      <p style={{ ...BODY, fontSize: 12, color: C.muted, marginTop: 1 }}>{cat.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => startEdit(cat)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                      style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, ...HEAD, cursor: "pointer" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.borderMid; (e.currentTarget as HTMLButtonElement).style.color = C.text }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = C.muted }}
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(cat.id, cat.active)}
                      className="px-3 py-1.5 rounded-lg text-xs"
                      style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, ...HEAD, cursor: "pointer" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.borderMid; (e.currentTarget as HTMLButtonElement).style.color = C.text }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = C.muted }}
                    >
                      {cat.active ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
