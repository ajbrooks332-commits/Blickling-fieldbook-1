import React, { useState } from "react"
import { useGetReportSummary } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Download, Printer, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react"

export default function Reports() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  })
  
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0];
  })

  const { data: summary, isLoading } = useGetReportSummary({ dateFrom, dateTo })

  if (isLoading || !summary) {
    return <div className="p-12 flex justify-center"><div className="animate-pulse h-8 w-8 bg-primary rounded-full"></div></div>
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Management Reports</h1>
          <p className="text-muted-foreground">Estate performance metrics and analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Print Report
          </Button>
          <Button>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center bg-muted/20">
          <div className="font-medium text-sm text-muted-foreground mr-2">Date Range:</div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full sm:w-[160px] bg-white h-9" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full sm:w-[160px] bg-white h-9" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-t-4 border-t-primary">
          <CardHeader className="pb-2 pt-4">
            <CardDescription>New Observations</CardDescription>
            <CardTitle className="text-3xl flex items-center justify-between">
              {summary.newObservations}
              <TrendingUp className="w-5 h-5 text-muted-foreground opacity-50" />
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card className="border-t-4 border-t-green-500">
          <CardHeader className="pb-2 pt-4">
            <CardDescription>Actions Completed</CardDescription>
            <CardTitle className="text-3xl flex items-center justify-between">
              {summary.actionsCompleted}
              <CheckCircle2 className="w-5 h-5 text-green-500 opacity-50" />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-t-4 border-t-destructive">
          <CardHeader className="pb-2 pt-4">
            <CardDescription>Overdue Actions</CardDescription>
            <CardTitle className="text-3xl text-destructive flex items-center justify-between">
              {summary.overdueActions}
              <AlertTriangle className="w-5 h-5 text-destructive opacity-50" />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-t-4 border-t-orange-500">
          <CardHeader className="pb-2 pt-4">
            <CardDescription>Urgent/High Items</CardDescription>
            <CardTitle className="text-3xl text-orange-600 flex items-center justify-between">
              {(summary.urgentItems || 0) + (summary.highItems || 0)}
              <AlertTriangle className="w-5 h-5 text-orange-600 opacity-50" />
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Breakdown by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.byCategory && summary.byCategory.length > 0 ? (
              <div className="space-y-4">
                {summary.byCategory.map(cat => (
                  <div key={cat.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{cat.label}</span>
                      <span className="font-medium">{cat.value}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="h-2 rounded-full" 
                        style={{ 
                          width: `${(cat.value / Math.max(...summary.byCategory!.map(c => c.value))) * 100}%`,
                          backgroundColor: cat.colour || 'hsl(var(--primary))'
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data for this period.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Safety & Access Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
               <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100">
                 <div className="flex items-center gap-3 text-red-900 font-medium">
                   <AlertTriangle className="text-red-600" />
                   Outstanding Safety Issues
                 </div>
                 <div className="text-2xl font-bold text-red-700">{summary.outstandingSafetyIssues || 0}</div>
               </div>
               
               <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-100">
                 <div className="flex items-center gap-3 text-orange-900 font-medium">
                   <AlertTriangle className="text-orange-600" />
                   Outstanding Access Issues
                 </div>
                 <div className="text-2xl font-bold text-orange-700">{summary.outstandingAccessIssues || 0}</div>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
