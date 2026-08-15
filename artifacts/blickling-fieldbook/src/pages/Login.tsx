import React from "react"
import { useLogin } from "@workspace/api-client-react"
import { useLocation } from "wouter"
import { useToast } from "@/hooks/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { getGetMeQueryKey } from "@workspace/api-client-react"
import { Loader2 } from "lucide-react"
import { clearPrivateCache } from "@/lib/offline"
import { recordOnlineAuth } from "@/lib/offlineStore"

const C = {
  bg: "#0d1117",
  surface: "#161b22",
  border: "#30363d",
  borderMid: "#21262d",
  text: "#e6edf3",
  muted: "#8b949e",
  dim: "#7d8590",
  emerald: "#10b981", emeraldBtn: "#047857",
  emeraldDark: "#0d9268",
  emeraldDim: "#065f46",
  urgent: "#f85149",
}

export default function Login() {
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const login = useLogin()
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login.mutate(
      { data: { email, password } },
      {
        onSuccess: async (data) => {
          await clearPrivateCache()
          queryClient.clear()
          queryClient.setQueryData(getGetMeQueryKey(), data)
          // Successful ONLINE authentication starts the 8-hour offline lease.
          const me = data as { id: number; propertyId?: number | null }
          await recordOnlineAuth(me.id, me.propertyId ?? 0).catch(() => undefined)
          setLocation("/")
        },
        onError: () => {
          toast({
            title: "Authentication failed",
            description: "Please check your credentials and try again.",
            variant: "destructive",
          })
        },
      }
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: C.bg, fontFamily: "'Inter', sans-serif" }}
    >
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(${C.borderMid} 1px, transparent 1px),
            linear-gradient(90deg, ${C.borderMid} 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          opacity: 0.3,
        }}
      />

      {/* Emerald radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 60%, rgba(16,185,129,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-sm space-y-8">

        {/* Logo mark + wordmark */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: C.emeraldDim, border: `1px solid rgba(16,185,129,0.3)` }}
            >
              <div className="w-6 h-6 rounded-md" style={{ background: C.emeraldBtn }} />
            </div>
            {/* Glow ring */}
            <div
              className="absolute -inset-1 rounded-2xl opacity-30"
              style={{ boxShadow: `0 0 24px ${C.emerald}` }}
            />
          </div>

          <div className="text-center space-y-1">
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.text }}
            >
              Blickling Estate
            </h1>
            <p className="text-sm font-medium tracking-widest uppercase" style={{ color: C.dim }}>
              Fieldbook
            </p>
          </div>
        </div>

        {/* Form card */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
          }}
        >
          <div className="space-y-1">
            <h2 className="text-lg font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.text }}>
              Sign in
            </h2>
            <p className="text-sm" style={{ color: C.muted }}>
              Enter your credentials to access the fieldbook.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3.5 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                  fontFamily: "'Inter', sans-serif",
                }}
                onFocus={e => { (e.target as HTMLElement).style.borderColor = C.emerald }}
                onBlur={e => { (e.target as HTMLElement).style.borderColor = C.border }}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3.5 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                  fontFamily: "'Inter', sans-serif",
                }}
                onFocus={e => { (e.target as HTMLElement).style.borderColor = C.emerald }}
                onBlur={e => { (e.target as HTMLElement).style.borderColor = C.border }}
              />
            </div>

            <button
              type="submit"
              disabled={login.isPending}
              className="w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
              style={{
                background: C.emeraldBtn,
                color: "#fff",
                fontFamily: "'Space Grotesk', sans-serif",
                boxShadow: `0 4px 20px rgba(16,185,129,0.3)`,
              }}
            >
              {login.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
              ) : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs" style={{ color: C.dim }}>
          Blickling Estate · National Trust · Norfolk
        </p>
      </div>
    </div>
  )
}
