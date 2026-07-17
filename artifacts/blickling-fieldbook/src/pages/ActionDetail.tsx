import React, { useState } from "react"
import { useGetAction, useUpdateActionStatus, useCreateNote, getGetActionQueryKey } from "@workspace/api-client-react"
import { useParams, useLocation, Link } from "wouter"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { AlertTriangle, ArrowUp, Minus, ArrowDown, MapPin, Clock, Edit, FileText, CheckCircle2, PlayCircle, MessageSquare } from "lucide-react"
import { formatShortDate, formatDate } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"

export default function ActionDetail() {
  const params = useParams<{ id: string }>()
  const id = Number(params.id)
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()

  const { data: act, isLoading } = useGetAction(id, { query: { enabled: !!id, queryKey: getGetActionQueryKey(id) } })
  const updateStatus = useUpdateActionStatus()
  const createNote = useCreateNote()

  const [noteOpen, setNoteOpen] = useState(false)
  const [noteBody, setNoteBody] = useState("")
  
  const [statusOpen, setStatusOpen] = useState(false)
  const [statusNote, setStatusNote] = useState("")
  const [pendingStatus, setPendingStatus] = useState<any>(null)

  if (isLoading || !act) {
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

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'not_started': return <Badge variant="outline" className="bg-slate-50 text-slate-600">Not Started</Badge>
      case 'planned': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Planned</Badge>
      case 'in_progress': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">In Progress</Badge>
      case 'waiting': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Waiting</Badge>
      case 'completed': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>
      case 'cancelled': return <Badge variant="outline" className="bg-slate-100 text-slate-400 border-transparent">Cancelled</Badge>
      default: return <Badge variant="outline">{s.replace('_', ' ')}</Badge>
    }
  }

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteBody.trim()) return
    createNote.mutate(
      { data: { body: noteBody, actionId: id } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetActionQueryKey(id) })
          setNoteOpen(false)
          setNoteBody("")
        }
      }
    )
  }

  const handleStatusUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingStatus) return
    
    const payload: any = { status: pendingStatus }
    if (pendingStatus === 'completed') payload.completionNote = statusNote
    if (pendingStatus === 'waiting') payload.waitingReason = statusNote
    if (pendingStatus === 'cancelled') payload.cancellationReason = statusNote

    updateStatus.mutate(
      { id, data: payload },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetActionQueryKey(id) })
          setStatusOpen(false)
          setPendingStatus(null)
          setStatusNote("")
        }
      }
    )
  }

  const promptStatusChange = (status: string) => {
    setPendingStatus(status)
    setStatusNote("")
    if (['completed', 'waiting', 'cancelled'].includes(status)) {
      setStatusOpen(true)
    } else {
      // Direct update for simple status changes
      updateStatus.mutate(
        { id, data: { status: status as any } },
        {
          onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetActionQueryKey(id) })
        }
      )
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-1 rounded-md">{act.referenceNumber}</span>
            {getStatusBadge(act.status)}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{act.title}</h1>
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
                <div className={`px-3 py-1.5 rounded-md text-sm font-semibold flex items-center gap-2 border ${getPriorityColor(act.priority)}`}>
                  <PriorityIcon p={act.priority} />
                  <span className="capitalize">{act.priority} Priority</span>
                </div>
                {act.dueDate && (
                  <div className="px-3 py-1.5 rounded-md text-sm bg-muted flex items-center gap-2 border border-black/5 text-slate-700">
                    <Clock className="w-4 h-4" />
                    <span>Due: {formatShortDate(act.dueDate)}</span>
                  </div>
                )}
              </div>

              {act.description && (
                <div className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {act.description}
                </div>
              )}

              <div className="grid grid-cols-2 gap-y-4 text-sm bg-muted/30 p-4 rounded-lg">
                <div>
                  <span className="block text-muted-foreground text-xs mb-1 uppercase tracking-wider">Assigned To</span>
                  {act.assignedToName ? (
                    <span className="font-medium bg-white px-2 py-1 rounded shadow-sm">{act.assignedToName}</span>
                  ) : (
                    <span className="text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded border border-orange-200">Unassigned</span>
                  )}
                </div>
                <div>
                  <span className="block text-muted-foreground text-xs mb-1 uppercase tracking-wider">Est. Time</span>
                  <span className="font-medium">{act.estimatedMinutes ? `${act.estimatedMinutes} mins` : 'Not specified'}</span>
                </div>
                {act.namedLocationName && (
                  <div className="col-span-2 flex items-center gap-2 text-primary font-medium mt-2">
                    <MapPin className="w-4 h-4" /> {act.namedLocationName}
                  </div>
                )}
                {act.observationId && (
                  <div className="col-span-2 mt-2 pt-4 border-t border-black/5">
                    <span className="block text-muted-foreground text-xs mb-2 uppercase tracking-wider">Linked Observation</span>
                    <Link href={`/observations/${act.observationId}`}>
                      <div className="bg-white p-3 rounded border hover:border-primary cursor-pointer transition-colors flex flex-col">
                        <span className="text-xs font-mono text-muted-foreground mb-1">{act.observationRef}</span>
                        <span className="font-medium">{act.observationTitle}</span>
                      </div>
                    </Link>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {act.equipmentRequired && <Badge variant="secondary" className="bg-slate-200">Equipment Req.</Badge>}
                {act.contractorRequired && <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200 border">Contractor Req.</Badge>}
              </div>

              {act.status === 'completed' && act.completionNote && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-100 text-sm">
                  <span className="font-semibold text-green-800 block mb-1">Completion Note</span>
                  <span className="text-green-900">{act.completionNote}</span>
                </div>
              )}
              {act.status === 'waiting' && act.waitingReason && (
                <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-100 text-sm">
                  <span className="font-semibold text-amber-800 block mb-1">Waiting Reason</span>
                  <span className="text-amber-900">{act.waitingReason}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notes</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {(!act.notes || act.notes.length === 0) ? (
                <p className="text-xs text-muted-foreground text-center py-4">No notes added.</p>
              ) : (
                <div className="space-y-4">
                  {act.notes.map(note => (
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
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b bg-muted/10">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex flex-col gap-3">
              {act.status === 'not_started' || act.status === 'planned' || act.status === 'waiting' ? (
                <Button className="w-full justify-start text-left bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => promptStatusChange('in_progress')}>
                  <PlayCircle className="w-4 h-4 mr-2" /> Start Action
                </Button>
              ) : null}
              
              {act.status === 'in_progress' ? (
                <>
                  <Button className="w-full justify-start text-left bg-green-600 hover:bg-green-700 text-white" onClick={() => promptStatusChange('completed')}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Complete
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-left text-amber-600 hover:text-amber-700" onClick={() => promptStatusChange('waiting')}>
                    Pause / Wait
                  </Button>
                </>
              ) : null}

              {act.status !== 'completed' && act.status !== 'cancelled' && (
                <div className="pt-4 border-t mt-2">
                  <Button variant="outline" className="w-full justify-start text-left" onClick={() => setNoteOpen(true)}>
                    <MessageSquare className="w-4 h-4 mr-2" /> Add Note
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">History</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
               {(!act.auditEvents || act.auditEvents.length === 0) ? null : (
                <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[5px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted-foreground/20 before:to-transparent">
                  {act.auditEvents.map((evt, i) => (
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

      <Dialog open={statusOpen} onOpenChange={(open) => { if (!open) setStatusOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingStatus === 'completed' ? 'Complete Action' :
               pendingStatus === 'waiting' ? 'Pause Action' :
               pendingStatus === 'cancelled' ? 'Cancel Action' : 'Update Status'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStatusUpdate} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {pendingStatus === 'completed' ? 'Completion Note (optional)' :
                 pendingStatus === 'waiting' ? 'Reason for waiting (required)' :
                 pendingStatus === 'cancelled' ? 'Reason for cancellation (required)' : 'Note'}
              </label>
              <Input 
                value={statusNote}
                onChange={e => setStatusNote(e.target.value)}
                required={['waiting', 'cancelled'].includes(pendingStatus)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStatusOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateStatus.isPending}>Confirm</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
