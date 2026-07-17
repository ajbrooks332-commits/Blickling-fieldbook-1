import React, { useState } from "react"
import { useCreateObservation, useListCategories, useListLocations } from "@workspace/api-client-react"
import { useLocation } from "wouter"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronRight, ChevronLeft, MapPin, Camera, Save, Check, Badge } from "lucide-react"

export default function ObservationNew() {
  const [, setLocation] = useLocation()
  const createObservation = useCreateObservation()
  const { data: categories } = useListCategories()
  const { data: locations } = useListLocations()

  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    categoryId: "",
    priority: "normal" as any,
    observedAt: new Date().toISOString().slice(0,16),
    latitude: null as number | null,
    longitude: null as number | null,
    namedLocationId: "",
    safetyIssue: false,
    publicAccessAffected: false,
    machineryRequired: false,
    followUpRequired: true
  })

  const handleNext = () => setStep(s => Math.min(s + 1, 5))
  const handlePrev = () => setStep(s => Math.max(s - 1, 1))

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setFormData(d => ({ ...d, latitude: pos.coords.latitude, longitude: pos.coords.longitude }))
      })
    }
  }

  const handleSubmit = (status: 'draft' | 'submitted') => {
    createObservation.mutate(
      {
        data: {
          title: formData.title,
          description: formData.description,
          categoryId: Number(formData.categoryId),
          priority: formData.priority,
          observedAt: new Date(formData.observedAt).toISOString(),
          status,
          latitude: formData.latitude || undefined,
          longitude: formData.longitude || undefined,
          namedLocationId: formData.namedLocationId ? Number(formData.namedLocationId) : undefined,
          safetyIssue: formData.safetyIssue,
          publicAccessAffected: formData.publicAccessAffected,
          machineryRequired: formData.machineryRequired,
          followUpRequired: formData.followUpRequired
        }
      },
      {
        onSuccess: (data) => {
          setLocation(`/observations/${data.id}`)
        }
      }
    )
  }

  const canProceed = () => {
    if (step === 2) return formData.title.trim().length > 0 && formData.categoryId
    return true
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-6">
        <span className={step >= 1 ? "text-primary" : ""}>Location</span> <ChevronRight className="w-4 h-4" />
        <span className={step >= 2 ? "text-primary" : ""}>Category</span> <ChevronRight className="w-4 h-4" />
        <span className={step >= 3 ? "text-primary" : ""}>Details</span> <ChevronRight className="w-4 h-4" />
        <span className={step >= 4 ? "text-primary" : ""}>Photos</span> <ChevronRight className="w-4 h-4" />
        <span className={step >= 5 ? "text-primary" : ""}>Review</span>
      </div>

      <Card className="border shadow-lg">
        {step === 1 && (
          <div className="animate-in slide-in-from-right-4">
            <CardHeader>
              <CardTitle>Where are you?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Button 
                variant="outline" 
                className="w-full h-16 flex items-center justify-center gap-3 text-lg border-primary/20 hover:bg-primary/5 hover:border-primary"
                onClick={handleGetLocation}
              >
                <MapPin className="w-5 h-5 text-primary" />
                {formData.latitude ? "GPS Location Captured" : "Capture GPS Location"}
                {formData.latitude && <Check className="w-5 h-5 text-green-600 ml-auto" />}
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or select location</span></div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Named Location (optional)</label>
                <select 
                  className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={formData.namedLocationId}
                  onChange={e => setFormData(d => ({ ...d, namedLocationId: e.target.value }))}
                >
                  <option value="">-- Select location --</option>
                  {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </CardContent>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in slide-in-from-right-4">
            <CardHeader>
              <CardTitle>What are you reporting?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-3">
                  {categories?.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setFormData(d => ({ ...d, categoryId: String(c.id) }))}
                      className={`p-3 text-left border rounded-lg text-sm transition-all ${formData.categoryId === String(c.id) ? 'border-primary ring-1 ring-primary bg-primary/5 font-medium' : 'hover:bg-muted'}`}
                    >
                      <div className="w-3 h-3 rounded-full mb-2" style={{ backgroundColor: c.displayColour || '#ccc' }}></div>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Brief Title <span className="text-red-500">*</span></label>
                <Input 
                  placeholder="e.g. Fallen branch on Main Drive" 
                  value={formData.title}
                  onChange={e => setFormData(d => ({ ...d, title: e.target.value }))}
                  maxLength={100}
                />
              </div>
            </CardContent>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in slide-in-from-right-4">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea 
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
                  placeholder="Additional context or details..."
                  value={formData.description}
                  onChange={e => setFormData(d => ({ ...d, description: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <div className="flex gap-2">
                  {['low', 'normal', 'high', 'urgent'].map(p => (
                    <button
                      key={p}
                      onClick={() => setFormData(d => ({ ...d, priority: p as any }))}
                      className={`flex-1 py-2 text-xs font-medium uppercase rounded border ${formData.priority === p ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-2">
                {[
                  { id: 'safetyIssue', label: 'Safety Issue' },
                  { id: 'publicAccessAffected', label: 'Public Access Affected' },
                  { id: 'machineryRequired', label: 'Machinery Required' },
                  { id: 'followUpRequired', label: 'Follow-up Required' }
                ].map(flag => (
                  <label key={flag.id} className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded text-primary focus:ring-primary border-input"
                      checked={formData[flag.id as keyof typeof formData] as boolean}
                      onChange={e => setFormData(d => ({ ...d, [flag.id]: e.target.checked }))}
                    />
                    <span className="text-sm">{flag.label}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </div>
        )}

        {step === 4 && (
          <div className="animate-in slide-in-from-right-4">
            <CardHeader>
              <CardTitle>Photographs</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-lg bg-muted/20">
              <Camera className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
              <h3 className="font-medium">Photo upload coming soon</h3>
              <p className="text-sm text-muted-foreground mt-2">Skip this step for now.</p>
            </CardContent>
          </div>
        )}

        {step === 5 && (
          <div className="animate-in slide-in-from-right-4">
            <CardHeader>
              <CardTitle>Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-3 text-sm">
                <div><span className="text-muted-foreground">Title:</span> <span className="font-medium">{formData.title}</span></div>
                <div><span className="text-muted-foreground">Priority:</span> <span className="font-medium uppercase">{formData.priority}</span></div>
                {formData.description && <div><span className="text-muted-foreground">Desc:</span> {formData.description}</div>}
                <div className="flex gap-2 flex-wrap mt-2">
                  {formData.safetyIssue && <Badge variant="destructive">Safety Issue</Badge>}
                  {formData.publicAccessAffected && <Badge variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-100">Access Blocked</Badge>}
                  {formData.machineryRequired && <Badge variant="outline">Machinery</Badge>}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button 
                className="w-full h-12 text-base" 
                onClick={() => handleSubmit('submitted')}
                disabled={createObservation.isPending}
              >
                Submit Observation
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-12" 
                onClick={() => handleSubmit('draft')}
                disabled={createObservation.isPending}
              >
                <Save className="w-4 h-4 mr-2" /> Save as Draft
              </Button>
            </CardFooter>
          </div>
        )}

        {step < 5 && (
          <CardFooter className="flex justify-between border-t bg-muted/10 p-4">
            {step > 1 ? (
              <Button variant="ghost" onClick={handlePrev}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
            ) : <div></div>}
            <Button onClick={handleNext} disabled={!canProceed()}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
