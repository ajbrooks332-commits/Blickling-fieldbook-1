import React from "react"
import { useGetMyActions, useUpdateActionStatus, getGetMyActionsQueryKey } from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Clock, PlayCircle, CheckCircle2, MoreHorizontal, ArrowUp, ArrowDown, Minus, MapPin, ChevronRight } from "lucide-react"
import { Link } from "wouter"
import { formatShortDate } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import { Action } from "@workspace/api-client-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

function PriorityBadge({ priority }: { priority: string }) {
  switch (priority) {
    case 'urgent': return <Badge variant="destructive" className="flex gap-1 items-center bg-red-600"><AlertTriangle className="w-3 h-3" /> Urgent</Badge>
    case 'high': return <Badge className="flex gap-1 items-center bg-amber-500 hover:bg-amber-600"><ArrowUp className="w-3 h-3" /> High</Badge>
    case 'normal': return <Badge className="flex gap-1 items-center bg-blue-500 hover:bg-blue-600"><Minus className="w-3 h-3" /> Normal</Badge>
    case 'low': return <Badge className="flex gap-1 items-center bg-slate-400 hover:bg-slate-500"><ArrowDown className="w-3 h-3" /> Low</Badge>
    default: return <Badge variant="outline">{priority}</Badge>
  }
}

export default function MyActions() {
  const { data: myActions, isLoading } = useGetMyActions()
  const updateStatus = useUpdateActionStatus()
  const queryClient = useQueryClient()
  
  const [completeActionId, setCompleteActionId] = React.useState<number | null>(null)
  const [completionNote, setCompletionNote] = React.useState("")

  if (isLoading || !myActions) {
    return <div className="p-8 flex justify-center"><div className="animate-pulse h-8 w-8 bg-primary rounded-full"></div></div>
  }

  const handleStatusChange = (id: number, status: 'in_progress' | 'waiting') => {
    updateStatus.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMyActionsQueryKey() })
        }
      }
    )
  }

  const handleComplete = (e: React.FormEvent) => {
    e.preventDefault()
    if (!completeActionId) return
    updateStatus.mutate(
      { id: completeActionId, data: { status: 'completed', completionNote } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMyActionsQueryKey() })
          setCompleteActionId(null)
          setCompletionNote("")
        }
      }
    )
  }

  const renderActionList = (actions: Action[], title: string, count: number, emptyMsg: string, isOverdue = false) => {
    if (actions.length === 0) return null
    return (
      <div className="space-y-3 mb-8">
        <h3 className={`font-semibold flex items-center gap-2 ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>
          {title} <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">{count}</span>
        </h3>
        <div className="space-y-3">
          {actions.map(action => (
            <Card key={action.id} className={`overflow-hidden transition-all ${isOverdue ? 'border-destructive/50 shadow-sm shadow-destructive/10' : ''}`}>
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                  {/* Info section */}
                  <Link href={`/actions/${action.id}`} className="flex-1 p-4 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-2 items-center">
                        <span className="text-xs font-mono text-muted-foreground">{action.referenceNumber}</span>
                        <PriorityBadge priority={action.priority} />
                      </div>
                      {action.dueDate && (
                        <div className={`text-xs flex items-center gap-1 font-medium ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                          <Clock className="w-3 h-3" /> {formatShortDate(action.dueDate)}
                        </div>
                      )}
                    </div>
                    
                    <h4 className="font-semibold text-[15px] mb-1 line-clamp-2">{action.title}</h4>
                    
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                      {action.observationRef && (
                        <span className="flex items-center gap-1" title="Linked Observation">
                          <Link href={`/observations/${action.observationId}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary hover:underline">
                            {action.observationRef}
                          </Link>
                        </span>
                      )}
                      {action.namedLocationName && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {action.namedLocationName}
                        </span>
                      )}
                    </div>
                  </Link>
                  
                  {/* Actions section */}
                  <div className="bg-muted/40 p-3 sm:w-48 border-t sm:border-t-0 sm:border-l flex flex-row sm:flex-col items-center justify-between sm:justify-center gap-2">
                    {action.status === 'not_started' || action.status === 'planned' ? (
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="w-full h-8 bg-white border shadow-sm"
                        onClick={() => handleStatusChange(action.id, 'in_progress')}
                      >
                        <PlayCircle className="w-4 h-4 mr-1" /> Start
                      </Button>
                    ) : action.status === 'in_progress' ? (
                      <>
                        <Button 
                          size="sm" 
                          className="w-full h-8 bg-green-600 hover:bg-green-700 text-white shadow-sm"
                          onClick={() => setCompleteActionId(action.id)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Complete
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="w-full h-8 text-xs text-muted-foreground"
                          onClick={() => handleStatusChange(action.id, 'waiting')}
                        >
                          Mark Waiting
                        </Button>
                      </>
                    ) : action.status === 'waiting' ? (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full h-8"
                        onClick={() => handleStatusChange(action.id, 'in_progress')}
                      >
                        <PlayCircle className="w-4 h-4 mr-1" /> Resume
                      </Button>
                    ) : action.status === 'completed' ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const allEmpty = !myActions.overdue.length && !myActions.dueToday.length && !myActions.dueThisWeek.length && !myActions.later.length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Actions</h1>
          <p className="text-muted-foreground">Your assigned work for today and beyond</p>
        </div>
        <Button asChild size="sm">
          <Link href="/actions/new">Add Action</Link>
        </Button>
      </div>

      {allEmpty && (
        <Card className="bg-muted/50 border-dashed text-center p-12">
          <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground">You're all caught up!</h3>
          <p className="text-muted-foreground mt-1">No actions currently assigned to you.</p>
        </Card>
      )}

      {renderActionList(myActions.overdue, "Overdue", myActions.overdue.length, "No overdue actions", true)}
      {renderActionList(myActions.dueToday, "Due Today", myActions.dueToday.length, "No actions due today")}
      {renderActionList(myActions.dueThisWeek, "Due This Week", myActions.dueThisWeek.length, "No actions due this week")}
      {renderActionList(myActions.later, "Later / Unscheduled", myActions.later.length, "")}
      
      {myActions.recentlyCompleted.length > 0 && (
        <div className="mt-12 pt-8 border-t">
          <h3 className="font-semibold text-muted-foreground mb-4">Recently Completed</h3>
          <div className="opacity-70 space-y-2">
            {myActions.recentlyCompleted.map(action => (
              <div key={action.id} className="flex items-center gap-3 text-sm p-2 rounded hover:bg-muted">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="font-medium">{action.title}</span>
                <span className="text-muted-foreground text-xs">{formatShortDate(action.completedAt)}</span>
                <Link href={`/actions/${action.id}`} className="ml-auto text-primary hover:underline text-xs">View</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!completeActionId} onOpenChange={(open) => !open && setCompleteActionId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Action</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleComplete} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Completion Note (optional)</label>
              <Input 
                placeholder="What was done? Any follow-up needed?" 
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCompleteActionId(null)}>Cancel</Button>
              <Button type="submit" disabled={updateStatus.isPending}>
                {updateStatus.isPending ? "Saving..." : "Mark Complete"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
