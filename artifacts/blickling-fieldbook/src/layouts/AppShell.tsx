import React from "react"
import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"
import { AuthUser } from "@workspace/api-client-react"
import {
  Home,
  Map as MapIcon,
  Plus,
  CheckSquare,
  X,
  FileText,
  Users,
  Tags,
  MapPin,
  Settings,
  LogOut,
  ListTodo,
  LayoutDashboard,
  ChevronRight,
} from "lucide-react"
import { useLogout } from "@workspace/api-client-react"

// ─── Terrain colour tokens (hardcoded for shell so they never depend on cascade) ─
const C = {
  bg: "#0d1117",
  surface: "#161b22",
  border: "#21262d",
  borderMid: "#30363d",
  text: "#e6edf3",
  textMuted: "#8b949e",
  textDim: "#484f58",
  emerald: "#10b981",
  emeraldDim: "#065f46",
}

const bottomNavItems = [
  { label: "Home",    href: "/",           icon: LayoutDashboard },
  { label: "Map",     href: "/map",         icon: MapIcon },
  { label: "record",  href: "/observations/new", icon: Plus, special: true },
  { label: "Actions", href: "/actions",     icon: CheckSquare },
  { label: "More",    href: "__more__",     icon: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>
    </svg>
  )},
]

const sidebarWork = [
  { label: "Dashboard",     href: "/",              icon: LayoutDashboard },
  { label: "All Actions",   href: "/actions",       icon: CheckSquare },
  { label: "My Actions",   href: "/actions/my",    icon: CheckSquare },
  { label: "Observations", href: "/observations",  icon: ListTodo },
  { label: "Map View",      href: "/map",            icon: MapIcon },
]

const sidebarAdmin = [
  { label: "Reports",    href: "/reports",    icon: FileText },
  { label: "Users",      href: "/users",      icon: Users },
  { label: "Categories", href: "/categories", icon: Tags },
  { label: "Locations",  href: "/locations",  icon: MapPin },
  { label: "Settings",   href: "/settings",   icon: Settings },
]

export default function AppShell({ children, user }: { children: React.ReactNode; user: AuthUser }) {
  const [location, setLocation] = useLocation()
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const logout = useLogout()

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => { window.location.href = "/login" } })
  }

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href)

  return (
    <div className="flex min-h-[100dvh] w-full" style={{ background: C.bg }}>

      {/* ── Desktop Sidebar ───────────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col h-[100dvh] sticky top-0 w-64"
        style={{ background: C.bg, borderRight: `1px solid ${C.border}` }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
               style={{ background: C.emeraldDim }}>
            <div className="w-3.5 h-3.5 rounded-sm" style={{ background: C.emerald }} />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight tracking-tight"
                 style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.text }}>
              Blickling Estate
            </div>
            <div className="text-[11px] leading-tight" style={{ color: C.textMuted }}>Fieldbook</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
          <NavSection label="Work" items={sidebarWork} location={location} isActive={isActive} />
          {(user.role === "administrator" || user.role === "manager") && (
            <NavSection label="Management" items={sidebarAdmin} location={location} isActive={isActive} />
          )}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 space-y-1" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                 style={{ background: C.emeraldDim, color: C.emerald }}>
              {user.name?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate" style={{ color: C.text }}>{user.name}</div>
              <div className="text-xs capitalize" style={{ color: C.textMuted }}>{user.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ color: C.textMuted }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(248,81,73,0.1)"; (e.currentTarget as HTMLElement).style.color = "#f85149" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = C.textMuted }}
          >
            <LogOut className="h-4 w-4" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* ── Main content area ─────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Desktop top bar */}
        <header className="hidden lg:flex items-center justify-between px-6 h-14 flex-shrink-0"
                style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="text-sm font-medium" style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.textMuted }}>
            {sidebarWork.find(i => isActive(i.href))?.label ||
             sidebarAdmin.find(i => isActive(i.href))?.label ||
             "Blickling Fieldbook"}
          </div>
          <Link href="/observations/new">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: C.emerald, color: "#fff", fontFamily: "'Space Grotesk', sans-serif" }}
            >
              <Plus className="h-4 w-4" />
              New Observation
            </button>
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom navigation ──────────────────────────────────────── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 safe-bottom"
        style={{ background: C.bg, borderTop: `1px solid ${C.border}` }}
      >
        <div className="flex items-end justify-around px-1 h-[60px]">
          {bottomNavItems.map(({ label, href, icon: Icon, special }) => {
            if (special) {
              return (
                <Link key={label} href={href}>
                  <button className="flex flex-col items-center justify-center -translate-y-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                      style={{ background: C.emerald }}
                    >
                      <Icon className="h-5 w-5" style={{ color: "#fff" }} />
                    </div>
                  </button>
                </Link>
              )
            }
            const active = href === "__more__" ? drawerOpen : isActive(href)
            return (
              <button
                key={label}
                className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 flex-1"
                onClick={() => href === "__more__" ? setDrawerOpen(true) : setLocation(href)}
              >
                <div className="relative">
                  {active && (
                    <span
                      className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ background: C.emerald }}
                    />
                  )}
                  <Icon
                    className="h-5 w-5"
                    style={{ color: active ? C.emerald : C.textDim }}
                  />
                </div>
                <span
                  className="text-[10px] font-medium"
                  style={{ color: active ? C.emerald : C.textDim, fontFamily: "'Inter', sans-serif" }}
                >
                  {label === "record" ? "" : label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* ── More drawer (mobile) ──────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div
            className="relative rounded-t-2xl overflow-hidden"
            style={{ background: C.surface, borderTop: `1px solid ${C.borderMid}` }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: C.borderMid }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
              <div>
                <div className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: C.text }}>
                  {user.name}
                </div>
                <div className="text-xs capitalize mt-0.5" style={{ color: C.textMuted }}>{user.role}</div>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg" style={{ background: C.border }}>
                <X className="h-4 w-4" style={{ color: C.textMuted }} />
              </button>
            </div>

            <div className="px-4 py-4 space-y-6">
              <DrawerSection label="Work">
                <DrawerItem icon={ListTodo}  label="All Observations" onClick={() => { setLocation("/observations"); setDrawerOpen(false) }} />
                <DrawerItem icon={CheckSquare} label="All Actions"   onClick={() => { setLocation("/actions"); setDrawerOpen(false) }} />
              </DrawerSection>

              {(user.role === "administrator" || user.role === "manager") && (
                <DrawerSection label="Management">
                  {sidebarAdmin.map(item => (
                    <DrawerItem
                      key={item.href}
                      icon={item.icon}
                      label={item.label}
                      onClick={() => { setLocation(item.href); setDrawerOpen(false) }}
                    />
                  ))}
                </DrawerSection>
              )}

              <div className="pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                <button
                  onClick={() => { handleLogout(); setDrawerOpen(false) }}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium"
                  style={{ color: "#f85149" }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(248,81,73,0.12)" }}>
                    <LogOut className="h-4 w-4" style={{ color: "#f85149" }} />
                  </div>
                  Log out
                </button>
              </div>
            </div>

            {/* Safe area spacer */}
            <div className="h-safe-bottom" />
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function NavSection({ label, items, location, isActive }: {
  label: string
  items: typeof sidebarWork
  location: string
  isActive: (href: string) => boolean
}) {
  return (
    <div>
      <div
        className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-2"
        style={{ color: "#484f58", fontFamily: "'Space Grotesk', sans-serif" }}
      >
        {label}
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = isActive(item.href)
          return (
            <li key={item.href}>
              <Link href={item.href}>
                <span
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer relative"
                  style={{
                    background: active ? "rgba(16,185,129,0.12)" : "transparent",
                    color: active ? "#10b981" : "#8b949e",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                      style={{ background: "#10b981" }}
                    />
                  )}
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function DrawerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest px-1 mb-2"
           style={{ color: "#484f58", fontFamily: "'Space Grotesk', sans-serif" }}>
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function DrawerItem({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-left transition-colors"
      style={{ color: "#e6edf3", fontFamily: "'Inter', sans-serif" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#21262d" }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#21262d" }}>
        <Icon className="h-4 w-4" style={{ color: "#8b949e" }} />
      </div>
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4" style={{ color: "#484f58" }} />
    </button>
  )
}
