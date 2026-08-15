import React, { useState } from "react"
import {
  useListLocations,
  useCreateLocation,
  useUpdateLocation,
  getListLocationsQueryKey,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Plus, MapPin, Pencil, Check, X } from "lucide-react"

const C = {
  bg: "#0d1117",
  surface: "#161b22",
  border: "#30363d",
  borderMid: "#21262d",
  text: "#e6edf3",
  muted: "#8b949e",
  dim: "#7d8590",
  emerald: "#10b981", emeraldBtn: "#047857",
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

interface EditRowState {
  name: string
  description: string
  latitude: string
  longitude: string
}

export default function Locations() {
  const { data: locations, isLoading, error: loadError } = useListLocations()
  const createLocation = useCreateLocation()
  const updateLocation = useUpdateLocation()
  const queryClient = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [newForm, setNewForm] = useState<EditRowState>({ name: "", description: "", latitude: "", longitude: "" })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EditRowState>({ name: "", description: "", latitude: "", longitude: "" })
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
  if (loadError || !locations) return <div role="alert" className="rounded-md border border-destructive/30 p-4">Locations could not be loaded.</div>

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setRequestError(null)
    if (!newForm.name.trim()) return
    const lat = newForm.latitude ? parseFloat(newForm.latitude) : undefined
    const lng = newForm.longitude ? parseFloat(newForm.longitude) : undefined
    createLocation.mutate(
      {
        data: {
          name: newForm.name,
          description: newForm.description || undefined,
          latitude: lat,
          longitude: lng,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() })
          setCreateOpen(false)
          setNewForm({ name: "", description: "", latitude: "", longitude: "" })
        }, onError: (error) => setRequestError(error instanceof Error ? error.message : "Location could not be created."),
      }
    )
  }

  const startEdit = (loc: typeof locations[0]) => {
    setEditingId(loc.id)
    setEditForm({
      name: loc.name,
      description: loc.description || "",
      latitude: loc.latitude != null ? String(loc.latitude) : "",
      longitude: loc.longitude != null ? String(loc.longitude) : "",
    })
  }

  const handleUpdate = (id: number) => {
    setRequestError(null)
    const lat = editForm.latitude ? parseFloat(editForm.latitude) : undefined
    const lng = editForm.longitude ? parseFloat(editForm.longitude) : undefined
    updateLocation.mutate(
      { id, data: { name: editForm.name, description: editForm.description || null, latitude: lat, longitude: lng } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() })
          setEditingId(null)
        }, onError: (error) => setRequestError(error instanceof Error ? error.message : "Location could not be updated."),
      }
    )
  }

  const handleToggleActive = (id: number, active: boolean) => {
    setRequestError(null)
    updateLocation.mutate(
      { id, data: { active: !active } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() }),
        onError: (error) => setRequestError(error instanceof Error ? error.message : "Location status could not be changed.") }
    )
  }

  const InputField = ({
    label, value, onChange, placeholder, type = "text",
  }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) => (
    <div className="space-y-1.5">
      <label htmlFor={`location-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`} style={{ ...HEAD, fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      <input
        id={`location-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, width: "100%" }}
        onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.emerald}
        onBlur={e => (e.target as HTMLInputElement).style.borderColor = C.border}
      />
    </div>
  )

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 style={{ ...HEAD, fontSize: 22, fontWeight: 700, color: C.text }}>Location Management</h1>
          <p style={{ ...BODY, fontSize: 13, color: C.muted, marginTop: 2 }}>Named estate areas and points of interest</p>
        </div>
        <button
          onClick={() => setCreateOpen(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
          style={{ background: C.emeraldBtn, color: "#fff", border: "none", ...HEAD, fontWeight: 600, cursor: "pointer" }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = C.emeraldDark}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = C.emerald}
        >
          <Plus className="w-4 h-4" /> Add Location
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
          <h2 style={{ ...HEAD, fontSize: 14, fontWeight: 600, color: C.text }}>New Location</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Name *" value={newForm.name} onChange={v => setNewForm(f => ({ ...f, name: v }))} placeholder="e.g. North Wood" />
            <InputField label="Description" value={newForm.description} onChange={v => setNewForm(f => ({ ...f, description: v }))} placeholder="Optional description" />
            <InputField label="Latitude" value={newForm.latitude} onChange={v => setNewForm(f => ({ ...f, latitude: v }))} placeholder="52.826" type="number" />
            <InputField label="Longitude" value={newForm.longitude} onChange={v => setNewForm(f => ({ ...f, longitude: v }))} placeholder="1.284" type="number" />
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
              disabled={createLocation.isPending}
              className="px-4 py-1.5 rounded-lg text-sm"
              style={{ background: C.emeraldBtn, color: "#fff", border: "none", ...HEAD, cursor: "pointer", opacity: createLocation.isPending ? 0.6 : 1 }}
            >
              {createLocation.isPending ? "Saving…" : "Save Location"}
            </button>
          </div>
        </form>
      )}

      {/* Location list */}
      <div className="rounded-xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        {locations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#21262d" }}>
              <MapPin className="w-6 h-6" style={{ color: C.dim }} />
            </div>
            <p style={{ ...BODY, color: C.muted, fontSize: 14 }}>No locations yet</p>
          </div>
        ) : (
          locations.map((loc, idx) => (
            <div
              key={loc.id}
              className="px-5 py-4"
              style={{
                borderBottom: idx < locations.length - 1 ? `1px solid ${C.borderMid}` : "none",
                opacity: loc.active ? 1 : 0.5,
              }}
            >
              {editingId === loc.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Name"
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
                    <input
                      type="number"
                      value={editForm.latitude}
                      onChange={e => setEditForm(f => ({ ...f, latitude: e.target.value }))}
                      placeholder="Latitude"
                      style={{ ...inputStyle, width: "100%" }}
                      onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.emerald}
                      onBlur={e => (e.target as HTMLInputElement).style.borderColor = C.border}
                    />
                    <input
                      type="number"
                      value={editForm.longitude}
                      onChange={e => setEditForm(f => ({ ...f, longitude: e.target.value }))}
                      placeholder="Longitude"
                      style={{ ...inputStyle, width: "100%" }}
                      onFocus={e => (e.target as HTMLInputElement).style.borderColor = C.emerald}
                      onBlur={e => (e.target as HTMLInputElement).style.borderColor = C.border}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(loc.id)}
                      disabled={updateLocation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                      style={{ background: C.emeraldBtn, color: "#fff", border: "none", ...HEAD, cursor: "pointer" }}
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
                <div className="flex items-start gap-4">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: C.emeraldTint }}
                  >
                    <MapPin className="w-4 h-4" style={{ color: C.emerald }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span style={{ ...HEAD, fontSize: 14, fontWeight: 600, color: C.text }}>{loc.name}</span>
                      {!loc.active && (
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
                    {loc.description && (
                      <p style={{ ...BODY, fontSize: 12, color: C.muted, marginTop: 1 }}>{loc.description}</p>
                    )}
                    {(loc.latitude != null && loc.longitude != null) && (
                      <p style={{ ...BODY, fontSize: 11, color: C.dim, marginTop: 2 }}>
                        {Number(loc.latitude).toFixed(5)}, {Number(loc.longitude).toFixed(5)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => startEdit(loc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                      style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, ...HEAD, cursor: "pointer" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.borderMid; (e.currentTarget as HTMLButtonElement).style.color = C.text }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = C.muted }}
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(loc.id, loc.active)}
                      className="px-3 py-1.5 rounded-lg text-xs"
                      style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, ...HEAD, cursor: "pointer" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.borderMid; (e.currentTarget as HTMLButtonElement).style.color = C.text }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = C.muted }}
                    >
                      {loc.active ? "Disable" : "Enable"}
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
