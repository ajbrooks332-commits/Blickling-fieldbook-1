import React, { useState, useEffect } from "react"
import { useGetObservation, useCreateAction, useUpdateObservationStatus, useCreateNote, getGetObservationQueryKey } from "@workspace/api-client-react"
import { useParams, useLocation, Link } from "wouter"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertTriangle, ArrowUp, Minus, ArrowDown, MapPin, Clock, Edit, FileText, CheckCircle2, AlertCircle, Map, MessageSquare, ChevronRight, Camera } from "lucide-react"
import { formatShortDate, formatDate, getInitials } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import PhotoGallery from "@/components/PhotoGallery"
import PhotoUpload from "@/components/PhotoUpload"

interface ObservationImage {
  id: number
  storageKey: string
  originalFilename: string
  caption?: string | null
  mimeType: string
}

export default function ObservationDetail() {
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()

  const { data: obs, isLoading } = useGetObservation(id, { query: { enabled: !!id, queryKey: getGetObservationQueryKey(id) } })
  const updateStatus = useUpdateObservationStatus()
  const createNote = useCreateNote()

  const [noteOpen, setNoteOpen] = useState(false)
  const [noteBody, setNoteBody] = useState("")
  const [statusOpen, setStatusOpen] = useState(false)

  const [images, setImages] = useState<ObservationImage[]>([])
  const [imagesLoading, setImagesLoading] = useState(false)

  const fetchImages = async () => {
    if (!id) return
    setImagesLoading(true)
    try {
      const res = await fetch(`/api/observations/${id}/images`)
      if (res.ok) {
        const data = await res.json()
        setImages(Array.isArray(data) ? data : (data.images || []))
      }
    } catch {
      // silently fail
    } finally {
      setImagesLoading(false)
    }
  }

  useEffect(() => {
    if (id) fetchImages()
  }, [id])

  const handlePhotoUploaded = async (image: { storageKey: string; originalFilename: string; mimeType: string; fileSize: number }) => {
    await fetch(`/api/observations/${id}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...image, imageType: 'observation' })
    })
    fetchImages()
  }

  const handleDeleteImage = async (imageId: number) => {
    await fetch(`/api/observations/${id}/images/${imageId}`, { method: 'DELETE' })
    setImages(prev => prev.filter(img => img.id !== imageId))
  }

  if (isLoading || !obs) {
    return <div className="p-12 flex justify-center"><div className="animate-pulse h-8 w-8 bg-primary rounded-full"></div></div>
  }

  const PriorityIcon = ({ p }: { p: string }) => {
    switch (p) {
      case 'urgent': return <AlertTriangle className="w-4 h-4" />
      case 'high': return <ArrowUp className="w-4 h-4" />
      case 'normal': return <Minus className="w-4 h-4" />
      case 'low': return <ArrowDown className="w-4 h-4" />
      default: return null
    }
  }

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'urgent': return 'text-destructive bg-destructive/10 border-destructive/20'
      case 'high': return 'text-orange-700 bg-orange-100 border-orange-200'
      case 'normal': return 'text-blue-700 bg-blue-100 border-blue-200'
      case 'low': return 'text-slate-700 bg-slate-100 border-slate-200'
      default: return 'text-muted-foreground bg-muted'
    }
  }

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteBody.trim()) return
    createNote.mutate(
      { data: { body: noteBody, observationId: id } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetObservationQueryKey(id) })
          setNoteOpen(false)
          setNoteBody("")
        }
      }
    )
  }

  const handleStatusUpdate = (newStatus: string) => {
    updateStatus.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetObservationQueryKey(id) })
          setStatusOpen(false)
        }
      }
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-1 rounded-md">{obs.referenceNumber}</span>
            <Badge variant="outline" className="uppercase text-[10px] tracking-wider bg-white">{obs.status.replace('_', ' ')}</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{obs.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation(`/observations/${id}/edit`)}>
            <Edit className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Button onClick={() => setLocation(`/actions/new?observationId=${id}`)}>
            Create Action
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              <div className="flex flex-wrap gap-4">
                <div className={`px-3 py-1.5 rounded-md text-sm font-semibold flex items-center gap-2 border ${getPriorityColor(obs.priority)}`}>
                  <PriorityIcon p={obs.priority} />
                  <span className="capitalize">{obs.priority} Priority</span>
                </div>
                <div className="px-3 py-1.5 rounded-md text-sm bg-muted flex items-center gap-2 border border-black/5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: obs.categoryColour || '#ccc' }}></div>
                  <span>{obs.categoryName}</span>
                </div>
              </div>

              {obs.description && (
                <div className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {obs.description}
                </div>
              )}

              <div className="grid grid-cols-2 gap-y-4 text-sm bg-muted/30 p-4 rounded-lg">
                <div>
                  <span className="block text-muted-foreground text-xs mb-1 uppercase tracking-wider">Reported By</span>
                  <span className="font-medium">{obs.reportedByName}</span>
                </div>
                <div>
                  <span className="block text-muted-foreground text-xs mb-1 uppercase tracking-wider">Observed At</span>
                  <span className="font-medium">{formatDate(obs.observedAt)}</span>
                </div>
                {obs.namedLocationName && (
                  <div className="col-span-2 flex items-center gap-2 text-primary font-medium">
                    <MapPin className="w-4 h-4" /> {obs.namedLocationName}
                  </div>
                )}
                {obs.latitude && obs.longitude && (
                  <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
                    <Map className="w-4 h-4" /> {obs.latitude.toFixed(6)}, {obs.longitude.toFixed(6)}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {obs.safetyIssue && <Badge variant="destructive" className="bg-red-600"><AlertCircle className="w-3 h-3 mr-1"/> Safety Issue</Badge>}
                {obs.publicAccessAffected && <Badge className="bg-orange-600 hover:bg-orange-700">Access Affected</Badge>}
                {obs.machineryRequired && <Badge variant="secondary">Machinery Req.</Badge>}
                {obs.followUpRequired && <Badge variant="outline">Follow-up Req.</Badge>}
              </div>
            </CardContent>
          </Card>

          {/* Photographs section */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Photographs
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <PhotoUpload
                onUploaded={handlePhotoUploaded}
                label="Add Photo"
              />
              {imagesLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-pulse h-6 w-6 bg-primary/40 rounded-full"></div>
                </div>
              ) : (
                <PhotoGallery
                  images={images}
                  onDelete={handleDeleteImage}
                  editable={true}
                />
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold tracking-tight">Linked Actions</h3>
            </div>
            {(!obs.actions || obs.actions.length === 0) ? (
              <Card className="border-dashed bg-transparent text-center p-8">
                <p className="text-muted-foreground text-sm">No actions created for this observation yet.</p>
                <Button variant="link" onClick={() => setLocation(`/actions/new?observationId=${id}`)} className="mt-2">
                  Create the first action
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {obs.actions.map(act => (
                  <Card key={act.id} className="hover:border-primary/50 transition-colors">
                    <Link href={`/actions/${act.id}`}>
                      <CardContent className="p-4 flex items-center justify-between cursor-pointer">
                        <div>
                          <div className="text-xs font-mono text-muted-foreground mb-1">{act.referenceNumber}</div>
                          <div className="font-medium text-[15px]">{act.title}</div>
                          <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                            <span className="capitalize text-primary font-medium">{act.status.replace('_', ' ')}</span>
                            {act.assignedToName && <span>To: {act.assignedToName}</span>}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </CardContent>
                    </Link>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/10">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Workflow</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <Button className="w-full justify-start text-left bg-slate-800 hover:bg-slate-900" onClick={() => setStatusOpen(true)}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Change Status
              </Button>
              <Button variant="outline" className="w-full justify-start text-left" onClick={() => setNoteOpen(true)}>
                <MessageSquare className="w-4 h-4 mr-2" /> Add Note
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notes</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {(!obs.notes || obs.notes.length === 0) ? (
                <p className="text-xs text-muted-foreground text-center py-4">No notes added.</p>
              ) : (
                <div className="space-y-4">
                  {obs.notes.map(note => (
                    <div key={note.id} className="text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">{note.createdByName}</span>
                        <span className="text-xs text-muted-foreground">{formatShortDate(note.createdAt)}</span>
                      </div>
                      <p className="text-foreground/80 bg-muted/50 p-3 rounded-md">{note.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">History</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
               {(!obs.auditEvents || obs.auditEvents.length === 0) ? null : (
                <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[5px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted-foreground/20 before:to-transparent">
                  {obs.auditEvents.map((evt, i) => (
                    <div key={evt.id} className="relative flex items-start gap-3 pl-4">
                      <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-background"></div>
                      <div className="text-xs">
                        <div className="font-medium text-foreground">
                          {evt.eventType === 'STATUS_CHANGE' ? (
                            <span>Status changed to <span className="uppercase text-[10px] bg-muted px-1 py-0.5 rounded">{evt.newValue?.replace('_', ' ')}</span></span>
                          ) : (
                            <span>{evt.eventType.replace('_', ' ')}</span>
                          )}
                        </div>
                        <div className="text-muted-foreground mt-0.5">{evt.userName} · {formatShortDate(evt.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
               )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddNote} className="space-y-4 pt-4">
            <textarea 
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px]"
              placeholder="Type your note here..."
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              required
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createNote.isPending || !noteBody.trim()}>
                {createNote.isPending ? "Adding..." : "Add Note"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
            {['submitted', 'under_review', 'action_required', 'monitoring', 'resolved', 'closed', 'cancelled'].map(s => (
              <Button 
                key={s} 
                variant={obs.status === s ? "default" : "outline"}
                className={`justify-start capitalize ${obs.status === s ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                onClick={() => handleStatusUpdate(s)}
                disabled={obs.status === s || updateStatus.isPending}
              >
                {s.replace('_', ' ')}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
