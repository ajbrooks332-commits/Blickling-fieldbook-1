import React, { useState } from "react"
import { useCreateAction, useGetObservation } from "@workspace/api-client-react"
import { useLocation } from "wouter"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Save, Clock, Users, ArrowLeft } from "lucide-react"

export default function ActionNew() {
  const [location, setLocation] = useLocation()
  
  // Extract observationId from query params if available
  const searchParams = new URLSearchParams(window.location.search)
  const obsIdParam = searchParams.get('observationId')
  const observationId = obsIdParam ? Number(obsIdParam) : undefined

  const { data: obs, isLoading: obsLoading } = useGetObservation(observationId || 0, {
    query: { enabled: !!observationId }
  })

  const createAction = useCreateAction()

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "normal" as any,
    status: "not_started" as any,
    dueDate: "",
    estimatedMinutes: "",
    equipmentRequired: false,
    contractorRequired: false,
    notes: ""
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createAction.mutate(
      {
        data: {
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          status: formData.status,
          dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
          estimatedMinutes: formData.estimatedMinutes ? Number(formData.estimatedMinutes) : undefined,
          equipmentRequired: formData.equipmentRequired,
          contractorRequired: formData.contractorRequired,
          notes: formData.notes,
          observationId: observationId
        }
      },
      {
        onSuccess: (data) => {
          setLocation(`/actions/${data.id}`)
        }
      }
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Action</h1>
          {obs && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              Linked to <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{obs.referenceNumber}</span> {obs.title}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Action Title <span className="text-destructive">*</span></label>
              <Input 
                required
                placeholder="e.g. Clear fallen branch and stack cordwood"
                value={formData.title}
                onChange={e => setFormData(d => ({ ...d, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea 
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                placeholder="Detailed instructions..."
                value={formData.description}
                onChange={e => setFormData(d => ({ ...d, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.priority}
                  onChange={e => setFormData(d => ({ ...d, priority: e.target.value as any }))}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.status}
                  onChange={e => setFormData(d => ({ ...d, status: e.target.value as any }))}
                >
                  <option value="not_started">Not Started</option>
                  <option value="planned">Planned</option>
                  <option value="in_progress">In Progress</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Due Date</label>
                <Input 
                  type="date"
                  value={formData.dueDate}
                  onChange={e => setFormData(d => ({ ...d, dueDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  Est. Minutes
                </label>
                <Input 
                  type="number"
                  min="0"
                  placeholder="e.g. 120"
                  value={formData.estimatedMinutes}
                  onChange={e => setFormData(d => ({ ...d, estimatedMinutes: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <label className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg border border-transparent hover:border-input transition-colors">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded text-primary focus:ring-primary border-input"
                  checked={formData.equipmentRequired}
                  onChange={e => setFormData(d => ({ ...d, equipmentRequired: e.target.checked }))}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Specialist Equipment Required</span>
                  <span className="text-xs text-muted-foreground">Tractor, chainsaw, cherry-picker etc.</span>
                </div>
              </label>

              <label className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg border border-transparent hover:border-input transition-colors">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded text-primary focus:ring-primary border-input"
                  checked={formData.contractorRequired}
                  onChange={e => setFormData(d => ({ ...d, contractorRequired: e.target.checked }))}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">External Contractor Required</span>
                  <span className="text-xs text-muted-foreground">Requires outside expertise or certification</span>
                </div>
              </label>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/10 border-t p-6">
            <div className="flex justify-end gap-3 w-full">
              <Button type="button" variant="outline" onClick={() => window.history.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={createAction.isPending || !formData.title.trim()}>
                <Save className="w-4 h-4 mr-2" /> 
                {createAction.isPending ? "Saving..." : "Create Action"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
