import React from "react"
import { useLocation } from "wouter"
import { Construction } from "lucide-react"

export default function PlaceholderPage({ title }: { title?: string }) {
  const [, setLocation] = useLocation()
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground mb-4">
        <Construction className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight">{title || "Under Construction"}</h2>
      <p className="text-muted-foreground max-w-md">
        This feature is currently being built for the Blickling Fieldbook. Check back later.
      </p>
      <button onClick={() => setLocation('/')} className="mt-8 text-primary font-medium hover:underline">
        Return to Dashboard
      </button>
    </div>
  )
}
