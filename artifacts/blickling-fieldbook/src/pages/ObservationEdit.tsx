import React from "react"
import { useLocation } from "wouter"
import { Construction } from "lucide-react"

const C = {
  surface: "#161b22",
  border: "#30363d",
  text: "#e6edf3",
  muted: "#8b949e",
  dim: "#484f58",
  emerald: "#10b981",
}

const HEAD = { fontFamily: "'Space Grotesk', sans-serif" }
const BODY = { fontFamily: "'Inter', sans-serif" }

export default function ObservationEdit() {
  const [, setLocation] = useLocation()
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ background: "#21262d" }}
      >
        <Construction className="w-8 h-8" style={{ color: C.dim }} />
      </div>
      <h2 style={{ ...HEAD, fontSize: 22, fontWeight: 700, color: C.text }}>Edit Observation</h2>
      <p style={{ ...BODY, color: C.muted, fontSize: 14, maxWidth: 400 }}>
        This feature is currently being built for the Blickling Fieldbook. Check back later.
      </p>
      <button
        onClick={() => setLocation('/')}
        className="mt-8"
        style={{ color: C.emerald, background: "none", border: "none", cursor: "pointer", ...HEAD, fontWeight: 500, fontSize: 14 }}
      >
        Return to Dashboard
      </button>
    </div>
  )
}
