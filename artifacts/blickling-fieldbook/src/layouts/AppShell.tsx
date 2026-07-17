import React from "react"
import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"
import { AuthUser } from "@workspace/api-client-react"
import { 
  Home, 
  Map as MapIcon, 
  Plus, 
  CheckSquare, 
  Menu,
  X,
  FileText,
  Users,
  Tags,
  MapPin,
  Settings,
  LogOut,
  ListTodo
} from "lucide-react"
import { useLogout } from "@workspace/api-client-react"

export default function AppShell({ children, user }: { children: React.ReactNode, user: AuthUser }) {
  const [location, setLocation] = useLocation()
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const logout = useLogout()

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.href = "/login"
      }
    })
  }

  const closeDrawer = () => setDrawerOpen(false)

  const navItems = [
    { label: "Dashboard", href: "/", icon: Home },
    { label: "My Actions", href: "/actions/my", icon: CheckSquare },
    { label: "Observations", href: "/observations", icon: ListTodo },
    { label: "Map View", href: "/map", icon: MapIcon },
  ]

  const adminItems = [
    { label: "Reports", href: "/reports", icon: FileText },
    { label: "Users", href: "/users", icon: Users },
    { label: "Categories", href: "/categories", icon: Tags },
    { label: "Locations", href: "/locations", icon: MapPin },
    { label: "Settings", href: "/settings", icon: Settings },
  ]

  return (
    <div className="flex min-h-[100dvh] bg-background w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 flex-col border-r bg-sidebar text-sidebar-foreground h-[100dvh] sticky top-0">
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-serif text-sidebar-primary">Blickling Estate</h1>
          <p className="text-sm text-sidebar-foreground/70 tracking-wide mt-1">Fieldbook</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-8">
          <div>
            <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-4 px-2">Work</div>
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium",
                    location === item.href 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}>
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {(user.role === 'administrator' || user.role === 'manager') && (
            <div>
              <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-4 px-2">Management</div>
              <ul className="space-y-1">
                {adminItems.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium",
                      location === item.href 
                        ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                        : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center justify-between px-2">
            <div className="flex flex-col">
              <span className="text-sm font-semibold truncate max-w-[160px]">{user.name}</span>
              <span className="text-xs text-sidebar-foreground/70 capitalize">{user.role.replace('_', ' ')}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-destructive transition-colors"
              title="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col w-full pb-20 lg:pb-0 min-w-0 overflow-x-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 bg-background border-b z-10 sticky top-0">
          <div>
            <h1 className="text-lg font-serif text-primary leading-tight">Blickling Estate</h1>
            <p className="text-xs text-muted-foreground">Fieldbook</p>
          </div>
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
            {user.name.charAt(0)}
          </div>
        </header>

        <div className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 border-t bg-background pb-safe z-40">
        <div className="flex items-center justify-around h-16 px-2">
          <button 
            onClick={() => setLocation('/')}
            className={cn("flex flex-col items-center justify-center w-16 h-full text-xs gap-1", location === '/' ? "text-primary font-medium" : "text-muted-foreground")}
          >
            <Home className="h-6 w-6" />
            <span>Home</span>
          </button>
          
          <button 
            onClick={() => setLocation('/map')}
            className={cn("flex flex-col items-center justify-center w-16 h-full text-xs gap-1", location === '/map' ? "text-primary font-medium" : "text-muted-foreground")}
          >
            <MapIcon className="h-6 w-6" />
            <span>Map</span>
          </button>
          
          {/* Dominant Record Button */}
          <button 
            onClick={() => setLocation('/observations/new')}
            className="flex flex-col items-center justify-center -mt-6 z-50 relative group"
          >
            <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg group-hover:scale-105 group-active:scale-95 transition-transform border-4 border-background">
              <Plus className="h-8 w-8" strokeWidth={2.5} />
            </div>
            <span className="text-xs font-semibold text-primary mt-1">Record</span>
          </button>
          
          <button 
            onClick={() => setLocation('/actions/my')}
            className={cn("flex flex-col items-center justify-center w-16 h-full text-xs gap-1", location === '/actions/my' ? "text-primary font-medium" : "text-muted-foreground")}
          >
            <CheckSquare className="h-6 w-6" />
            <span>Actions</span>
          </button>
          
          <button 
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center justify-center w-16 h-full text-xs gap-1 text-muted-foreground"
          >
            <Menu className="h-6 w-6" />
            <span>More</span>
          </button>
        </div>
      </div>

      {/* Mobile More Drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="relative bg-background rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom">
            <div className="p-4 border-b flex items-center justify-between bg-muted/30">
              <span className="font-semibold text-foreground">Menu</span>
              <button onClick={closeDrawer} className="p-2 -mr-2 bg-muted rounded-full text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              <div className="space-y-6">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">Work</div>
                  <div className="grid grid-cols-1 gap-1">
                    <button onClick={() => { setLocation('/observations'); closeDrawer(); }} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-left">
                      <ListTodo className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium text-sm">All Observations</span>
                    </button>
                    <button onClick={() => { setLocation('/actions'); closeDrawer(); }} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-left">
                      <CheckSquare className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium text-sm">All Actions</span>
                    </button>
                  </div>
                </div>

                {(user.role === 'administrator' || user.role === 'manager') && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">Management</div>
                    <div className="grid grid-cols-1 gap-1">
                      {adminItems.map(item => (
                        <button key={item.href} onClick={() => { setLocation(item.href); closeDrawer(); }} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-left">
                          <item.icon className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium text-sm">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="pt-4 border-t">
                  <button onClick={() => { handleLogout(); closeDrawer(); }} className="flex items-center gap-3 p-3 rounded-lg hover:bg-destructive/10 text-destructive text-left w-full">
                    <LogOut className="h-5 w-5" />
                    <span className="font-medium text-sm">Log Out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
