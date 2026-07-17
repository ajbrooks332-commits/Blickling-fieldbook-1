import React, { useState } from "react"
import { useListObservations } from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, AlertTriangle, ArrowUp, Minus, ArrowDown, MapPin } from "lucide-react"
import { Link } from "wouter"
import { formatShortDate } from "@/lib/utils"

export default function ObservationList() {
  const [search, setSearch] = useState("")
  const { data: listData, isLoading } = useListObservations({ status: '', search })

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
      case 'urgent': return 'text-destructive bg-destructive/10'
      case 'high': return 'text-orange-600 bg-orange-100'
      case 'normal': return 'text-blue-600 bg-blue-100'
      case 'low': return 'text-slate-600 bg-slate-100'
      default: return 'text-muted-foreground bg-muted'
    }
  }

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'draft': return 'bg-slate-200 text-slate-700'
      case 'submitted': return 'bg-blue-100 text-blue-700'
      case 'under_review': return 'bg-purple-100 text-purple-700'
      case 'action_required': return 'bg-amber-100 text-amber-700'
      case 'monitoring': return 'bg-teal-100 text-teal-700'
      case 'resolved': return 'bg-green-100 text-green-700'
      case 'closed': return 'bg-slate-800 text-slate-100'
      case 'cancelled': return 'bg-slate-100 text-slate-400'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Observations</h1>
          <p className="text-muted-foreground">Field records across the estate</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search reference, title, location..." 
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
      ) : listData?.observations.length === 0 ? (
        <div className="text-center p-12 bg-muted/30 border border-dashed rounded-xl">
          <p className="text-muted-foreground">No observations found.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {listData?.observations.map(obs => (
            <Link key={obs.id} href={`/observations/${obs.id}`}>
              <Card className="hover-elevate cursor-pointer transition-all border hover:border-primary/30">
                <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="flex-1 w-full space-y-2">
                    <div className="flex items-center justify-between sm:justify-start gap-3 w-full">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {obs.referenceNumber}
                      </span>
                      <div className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${getPriorityColor(obs.priority)}`}>
                        <PriorityIcon p={obs.priority} />
                        <span className="capitalize">{obs.priority}</span>
                      </div>
                      <Badge variant="outline" className={`ml-auto sm:ml-0 border-transparent ${getStatusColor(obs.status)}`}>
                        {obs.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    <h3 className="font-semibold text-[15px]">{obs.title}</h3>
                    
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: obs.categoryColour || '#ccc' }}></div>
                        {obs.categoryName}
                      </span>
                      {obs.namedLocationName && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {obs.namedLocationName}
                        </span>
                      )}
                      <span>{formatShortDate(obs.observedAt)}</span>
                    </div>
                  </div>
                  
                  {obs.actionCount ? (
                    <div className="flex-shrink-0 bg-slate-50 border px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 self-end sm:self-auto">
                      {obs.actionCount} action{obs.actionCount !== 1 && 's'}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
