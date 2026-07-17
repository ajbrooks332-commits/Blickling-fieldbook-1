import React from "react"
import { useListActions } from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, AlertTriangle, ArrowUp, Minus, ArrowDown, MapPin, Clock } from "lucide-react"
import { Link } from "wouter"
import { formatShortDate } from "@/lib/utils"

export default function ActionList() {
  const [search, setSearch] = React.useState("")
  const { data: listData, isLoading } = useListActions({ status: '', search })

  const PriorityIcon = ({ p }: { p: string }) => {
    switch (p) {
      case 'urgent': return <AlertTriangle className="w-3 h-3" />
      case 'high': return <ArrowUp className="w-3 h-3" />
      case 'normal': return <Minus className="w-3 h-3" />
      case 'low': return <ArrowDown className="w-3 h-3" />
      default: return null
    }
  }

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'urgent': return 'text-destructive bg-destructive/10 border-destructive/20'
      case 'high': return 'text-orange-700 bg-orange-100 border-orange-200'
      case 'normal': return 'text-blue-700 bg-blue-100 border-blue-200'
      case 'low': return 'text-slate-700 bg-slate-100 border-slate-200'
      default: return 'text-muted-foreground bg-muted border-transparent'
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Actions</h1>
          <p className="text-muted-foreground">Manage tasks and assignments across the estate</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search action ref, title, assignee..." 
            className="pl-9 bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="px-4 py-2 bg-white border rounded-md shadow-sm text-sm font-medium flex items-center gap-2 hover:bg-muted/50">
          <Filter className="h-4 w-4" /> Filters
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><div className="animate-pulse h-8 w-8 bg-primary rounded-full" /></div>
      ) : listData?.actions.length === 0 ? (
        <div className="text-center p-12 bg-muted/30 border border-dashed rounded-xl">
          <p className="text-muted-foreground">No actions found.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {listData?.actions.map(act => (
            <Link key={act.id} href={`/actions/${act.id}`}>
              <Card className="hover-elevate cursor-pointer transition-all border hover:border-primary/30">
                <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="flex-1 w-full space-y-2">
                    <div className="flex items-center justify-between sm:justify-start gap-3 w-full">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {act.referenceNumber}
                      </span>
                      <div className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 border ${getPriorityColor(act.priority)}`}>
                        <PriorityIcon p={act.priority} />
                        <span className="capitalize">{act.priority}</span>
                      </div>
                      <div className="ml-auto sm:ml-0">
                        {getStatusBadge(act.status)}
                      </div>
                    </div>
                    
                    <h3 className="font-semibold text-[15px]">{act.title}</h3>
                    
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-2">
                      {act.assignedToName ? (
                        <span className="font-medium text-foreground bg-slate-100 px-2 py-1 rounded">
                          {act.assignedToName}
                        </span>
                      ) : (
                        <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200">Unassigned</span>
                      )}
                      
                      {act.dueDate && (
                        <span className="flex items-center gap-1 text-slate-600">
                          <Clock className="w-3 h-3" /> Due {formatShortDate(act.dueDate)}
                        </span>
                      )}
                      
                      {act.namedLocationName && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {act.namedLocationName}
                        </span>
                      )}
                      
                      {act.observationRef && (
                        <span className="flex items-center gap-1 opacity-70">
                          Linked: {act.observationRef}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
