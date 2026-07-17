import React, { useState, useEffect, useRef } from "react"
import { useCreateObservation, useListCategories, useListLocations } from "@workspace/api-client-react"
import { useLocation } from "wouter"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronRight, ChevronLeft, MapPin, Camera, Save, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import PhotoUpload from "@/components/PhotoUpload"
import PhotoGallery from "@/components/PhotoGallery"
import { MapContainer, TileLayer, Marker } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

// Fix leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

interface PendingPhoto {
  storageKey: string
  originalFilename: string
  mimeType: string
  fileSize: number
}

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
    gpsAccuracy: null as number | null,
    namedLocationId: "",
    safetyIssue: false,
    publicAccessAffected: false,
    machineryRequired: false,
    followUpRequired: true
  })

  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>()

  const handleNext = () => setStep(s => Math.min(s + 1, 5))
  const handlePrev = () => setStep(s => Math.max(s - 1, 1))

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setFormData(d => ({
          ...d,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          gpsAccuracy: pos.coords.accuracy ?? null,
        }))
      })
    }
  }

  const handlePhotoUploaded = (image: PendingPhoto) => {
    setPendingPhotos(prev => [...(prev || []), image])
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
        onSuccess: async (data) => {
          // Upload any pending photos
          for (const photo of (pendingPhotos || [])) {
            await fetch(`/api/observations/${data.id}/images`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...photo, imageType: 'observation' })
            })
          }
          setLocation(`/observations/${data.id}`)
        }
      }
    )
  }

  const canProceed = () => {
    if (step === 2) return formData.title.trim().length > 0 && formData.categoryId
    return true
  }

  // Build fake gallery items from pending photos for preview
  const pendingGalleryItems = (pendingPhotos || []).map((p, i) => ({
    id: i,
    storageKey: p.storageKey,
    originalFilename: p.originalFilename,
    mimeType: p.mimeType,
    caption: null,
  }))

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

              {formData.latitude && formData.longitude && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    GPS captured: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                    {formData.gpsAccuracy != null && ` (±${Math.round(formData.gpsAccuracy)}m)`}
                  </p>
                  <div className="rounded-md overflow-hidden border h-[150px]">
                    <MapContainer
                      center={[formData.latitude, formData.longitude]}
                      zoom={16}
                      style={{ height: "150px", width: "100%" }}
                      zoomControl={false}
                      attributionControl={false}
                      dragging={false}
                      scrollWheelZoom={false}
                      doubleClickZoom={false}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={[formData.latitude, formData.longitude]} />
                    </MapContainer>
                  </div>
                </div>
              )}
              
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
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Photographs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PhotoUpload
                onUploaded={handlePhotoUploaded}
                label="Take / Add Photo"
              />

              {(pendingPhotos && pendingPhotos.length > 0) ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {pendingPhotos.length} photo{pendingPhotos.length !== 1 ? "s" : ""} ready to upload
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {pendingPhotos.map((p, i) => (
                      <div key={i} className="relative rounded-md overflow-hidden border bg-muted aspect-square">
                        <img
                          src={`/api/storage${p.storageKey}`}
                          alt={p.originalFilename}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setPendingPhotos(prev => (prev || []).filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No photos added yet. Photos are optional.</p>
              )}
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
                {(pendingPhotos && pendingPhotos.length > 0) && (
                  <div><span className="text-muted-foreground">Photos:</span> <span className="font-medium">{pendingPhotos.length} photo{pendingPhotos.length !== 1 ? "s" : ""} queued</span></div>
                )}
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
