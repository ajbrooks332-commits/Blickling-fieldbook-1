import React from "react"
import { useGetDashboardSummary, useGetDashboardCharts } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, ArrowUp, CheckSquare, Clock, MapPin, Activity } from "lucide-react"
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from "recharts"

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary()
  const { data: charts, isLoading: loadingCharts } = useGetDashboardCharts()

  if (loadingSummary || loadingCharts) {
    return <div className="p-8 flex justify-center"><div className="animate-pulse flex space-x-4"><div className="h-4 w-4 bg-primary rounded-full"></div><div className="h-4 w-4 bg-primary rounded-full delay-75"></div><div className="h-4 w-4 bg-primary rounded-full delay-150"></div></div></div>
  }

  if (!summary || !charts) return <div>Failed to load dashboard.</div>

  const COLORS = {
    green: 'hsl(147 26% 24%)',
    brown: 'hsl(25 30% 45%)',
    blue: 'hsl(198 40% 45%)',
    red: 'hsl(8 60% 45%)',
    yellow: 'hsl(45 80% 55%)'
  }

  const pieColors = [COLORS.green, COLORS.brown, COLORS.blue, COLORS.yellow, COLORS.red]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground">Welcome to the Blickling Fieldbook</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-destructive text-destructive-foreground border-none">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4 space-y-0">
            <CardTitle className="text-sm font-medium">Urgent Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 opacity-75" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold">{summary.urgentObservations}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4 space-y-0">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <ArrowUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold text-orange-600">{summary.highObservations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4 space-y-0">
            <CardTitle className="text-sm font-medium">Overdue Actions</CardTitle>
            <Clock className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold text-destructive">{summary.overdueActions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4 space-y-0">
            <CardTitle className="text-sm font-medium">Open Records</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold">{summary.openObservations}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observations by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.byCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="label"
                  >
                    {charts.byCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.colour || pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    itemStyle={{ color: '#1a1a1a' }}
                    formatter={(value, name) => [value, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 text-xs border-t pt-4">
              {charts.byCategory.map((c, i) => (
                <div key={c.label} className="flex items-center gap-1.5 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: c.colour || pieColors[i % pieColors.length] }}></div>
                  <span className="text-muted-foreground truncate">{c.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observations Over Time (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.observationsOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                <XAxis dataKey="date" tickFormatter={(val) => val.substring(5)} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Line type="monotone" dataKey="value" stroke={COLORS.green} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
