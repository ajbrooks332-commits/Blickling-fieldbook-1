import React from "react";
import { 
  AlertTriangle, 
  ArrowUp, 
  Clock, 
  Activity, 
  MapPin, 
  Bell, 
  Home, 
  Map as MapIcon, 
  Plus, 
  CheckSquare, 
  MoreHorizontal
} from "lucide-react";

export default function Terrain() {
  return (
    <div className="min-h-[100dvh] w-[390px] mx-auto bg-[#0d1117] text-[#e6edf3] font-['Inter'] relative pb-24 overflow-x-hidden selection:bg-[#10b981]/30">
      
      {/* 1. Top header bar */}
      <header className="h-14 px-4 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-[14px] h-[14px] bg-[#065f46] flex items-center justify-center">
            <div className="w-[8px] h-[8px] bg-white"></div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-['Space_Grotesk'] font-semibold text-[16px] tracking-tight text-[#e6edf3]">
              Blickling
            </span>
            <span className="text-[12px] text-[#8b949e]">Estate</span>
          </div>
        </div>
        <div className="flex items-center gap-3.5">
          <Bell className="w-4 h-4 text-[#8b949e]" strokeWidth={2} />
          <div className="w-[24px] h-[24px] rounded-full bg-[#10b981] flex items-center justify-center text-[11px] font-medium text-white shadow-sm shadow-[#10b981]/20">
            SJ
          </div>
        </div>
      </header>

      {/* 2. Welcome banner */}
      <section className="px-4 pt-5 pb-3">
        <h1 className="font-['Space_Grotesk'] font-semibold text-[20px] tracking-tight text-[#e6edf3]">
          Good morning, Sarah
        </h1>
        <p className="text-[12px] text-[#8b949e] mt-1 tracking-wide">
          Thursday, 17 July 2026 · Blickling Estate, Norfolk
        </p>
      </section>

      {/* 3. Alert banner */}
      <div className="mx-4 mt-1 bg-[#1f1408] border border-[#d29922]/40 rounded-lg px-3 py-2.5 flex items-center gap-2.5 shadow-sm">
        <AlertTriangle className="w-[14px] h-[14px] text-[#d29922] shrink-0" strokeWidth={2.5} />
        <span className="text-[12px] text-[#d29922] font-medium">
          3 urgent issues require immediate attention
        </span>
      </div>

      {/* 4. Metric tiles */}
      <div className="grid grid-cols-2 px-4 mt-4 gap-3">
        {/* Tile 1 */}
        <div className="bg-[#161b22] border border-[#30363d] border-l-[3px] border-l-[#f85149] rounded-xl p-3 relative overflow-hidden flex flex-col justify-between aspect-[16/11]">
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-[#f85149] opacity-[0.04] blur-xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-medium text-[#8b949e] uppercase tracking-wider">Urgent Issues</span>
            <AlertTriangle className="w-[14px] h-[14px] text-[#f85149]" strokeWidth={2.5} />
          </div>
          <div className="font-['Space_Grotesk'] font-bold text-[28px] text-[#f85149] leading-none mt-2">
            3
          </div>
        </div>
        
        {/* Tile 2 */}
        <div className="bg-[#161b22] border border-[#30363d] border-l-[3px] border-l-[#d29922] rounded-xl p-3 relative overflow-hidden flex flex-col justify-between aspect-[16/11]">
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-[#d29922] opacity-[0.04] blur-xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-medium text-[#8b949e] uppercase tracking-wider">High Priority</span>
            <ArrowUp className="w-[14px] h-[14px] text-[#d29922]" strokeWidth={3} />
          </div>
          <div className="font-['Space_Grotesk'] font-bold text-[28px] text-[#d29922] leading-none mt-2">
            8
          </div>
        </div>

        {/* Tile 3 */}
        <div className="bg-[#161b22] border border-[#30363d] border-l-[3px] border-l-[#f85149] rounded-xl p-3 relative overflow-hidden flex flex-col justify-between aspect-[16/11]">
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-[#f85149] opacity-[0.04] blur-xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-medium text-[#8b949e] uppercase tracking-wider">Overdue Actions</span>
            <Clock className="w-[14px] h-[14px] text-[#f85149]" strokeWidth={2.5} />
          </div>
          <div className="font-['Space_Grotesk'] font-bold text-[28px] text-[#f85149] leading-none mt-2">
            2
          </div>
        </div>

        {/* Tile 4 */}
        <div className="bg-[#161b22] border border-[#30363d] border-l-[3px] border-l-[#10b981] rounded-xl p-3 relative overflow-hidden flex flex-col justify-between aspect-[16/11]">
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-[#10b981] opacity-[0.04] blur-xl pointer-events-none" />
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-medium text-[#8b949e] uppercase tracking-wider">Open Records</span>
            <Activity className="w-[14px] h-[14px] text-[#10b981]" strokeWidth={2.5} />
          </div>
          <div className="font-['Space_Grotesk'] font-bold text-[28px] text-[#e6edf3] leading-none mt-2">
            21
          </div>
        </div>
      </div>

      {/* 5. Category breakdown */}
      <div className="mx-4 mt-4 bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="font-['Space_Grotesk'] font-semibold text-[13px] text-[#e6edf3]">Category Breakdown</h2>
          <span className="text-[11px] text-[#8b949e]">Active observations</span>
        </div>
        
        <div className="flex flex-col gap-[10px]">
          {/* Bar 1 */}
          <div className="flex items-center">
            <span className="text-[12px] text-[#8b949e] w-28 shrink-0">Paths & Access</span>
            <div className="flex-1 h-2 bg-[#21262d] rounded-full overflow-hidden">
              <div className="h-full bg-[#10b981] rounded-full" style={{ width: '40%' }} />
            </div>
            <span className="text-[12px] text-[#8b949e] w-5 text-right shrink-0 font-medium">9</span>
          </div>
          {/* Bar 2 */}
          <div className="flex items-center">
            <span className="text-[12px] text-[#8b949e] w-28 shrink-0">Tree Safety</span>
            <div className="flex-1 h-2 bg-[#21262d] rounded-full overflow-hidden">
              <div className="h-full bg-[#58a6ff] rounded-full" style={{ width: '25%' }} />
            </div>
            <span className="text-[12px] text-[#8b949e] w-5 text-right shrink-0 font-medium">6</span>
          </div>
          {/* Bar 3 */}
          <div className="flex items-center">
            <span className="text-[12px] text-[#8b949e] w-28 shrink-0">Water & Drainage</span>
            <div className="flex-1 h-2 bg-[#21262d] rounded-full overflow-hidden">
              <div className="h-full bg-[#d29922] rounded-full" style={{ width: '20%' }} />
            </div>
            <span className="text-[12px] text-[#8b949e] w-5 text-right shrink-0 font-medium">4</span>
          </div>
          {/* Bar 4 */}
          <div className="flex items-center">
            <span className="text-[12px] text-[#8b949e] w-28 shrink-0">Built Structures</span>
            <div className="flex-1 h-2 bg-[#21262d] rounded-full overflow-hidden">
              <div className="h-full bg-[#8b949e] rounded-full" style={{ width: '15%' }} />
            </div>
            <span className="text-[12px] text-[#8b949e] w-5 text-right shrink-0 font-medium">3</span>
          </div>
        </div>
      </div>

      {/* 6. Recent Observations */}
      <div className="mx-4 mt-5 mb-6">
        <div className="flex justify-between items-baseline mb-3">
          <h2 className="font-['Space_Grotesk'] font-semibold text-[13px] text-[#e6edf3]">Recent Observations</h2>
          <button className="text-[12px] text-[#10b981] font-medium hover:text-[#10b981]/80 transition-colors">
            View all &rarr;
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {/* Item 1 */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3 flex flex-col gap-2">
            <div className="flex justify-between items-start gap-3">
              <span className="text-[13px] font-medium text-[#e6edf3] leading-snug">
                Fallen oak limb obstructing Lake Walk
              </span>
              <span className="shrink-0 bg-[#f85149]/15 text-[#f85149] text-[10px] font-medium px-2 py-0.5 rounded-full border border-[#f85149]/20 uppercase tracking-wide">
                Urgent
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-[#8b949e]">
              <MapPin className="w-3 h-3" />
              <span>Parkland</span>
              <span className="opacity-50">&middot;</span>
              <div className="flex items-center gap-1 bg-[#161b22] border border-[#30363d] rounded-full px-1.5 py-0.5 text-[10px]">
                <span>🔴</span>
                <span className="text-[#e6edf3] font-medium">Action Required</span>
              </div>
            </div>
          </div>

          {/* Item 2 */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3 flex flex-col gap-2">
            <div className="flex justify-between items-start gap-3">
              <span className="text-[13px] font-medium text-[#e6edf3] leading-snug">
                North ha-ha wall erosion &mdash; east section
              </span>
              <span className="shrink-0 bg-[#d29922]/15 text-[#d29922] text-[10px] font-medium px-2 py-0.5 rounded-full border border-[#d29922]/20 uppercase tracking-wide">
                High
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-[#8b949e]">
              <MapPin className="w-3 h-3" />
              <span>Walled Garden</span>
              <span className="opacity-50">&middot;</span>
              <div className="flex items-center gap-1 bg-[#161b22] border border-[#30363d] rounded-full px-1.5 py-0.5 text-[10px]">
                <span>🟡</span>
                <span className="text-[#e6edf3] font-medium">Under Review</span>
              </div>
            </div>
          </div>

          {/* Item 3 */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3 flex flex-col gap-2">
            <div className="flex justify-between items-start gap-3">
              <span className="text-[13px] font-medium text-[#e6edf3] leading-snug">
                Footbridge handrail loose &mdash; main path
              </span>
              <span className="shrink-0 bg-[#d29922]/15 text-[#d29922] text-[10px] font-medium px-2 py-0.5 rounded-full border border-[#d29922]/20 uppercase tracking-wide">
                High
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-[#8b949e]">
              <MapPin className="w-3 h-3" />
              <span>Lake Walk</span>
              <span className="opacity-50">&middot;</span>
              <div className="flex items-center gap-1 bg-[#161b22] border border-[#30363d] rounded-full px-1.5 py-0.5 text-[10px]">
                <span>🔵</span>
                <span className="text-[#e6edf3] font-medium">Submitted</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Bottom navigation */}
      <nav className="fixed bottom-0 w-[390px] h-[64px] bg-[#0d1117] border-t border-[#21262d] z-30 flex items-center justify-between px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        
        {/* Home (Active) */}
        <button className="flex-1 h-full flex flex-col items-center justify-center gap-1 relative group">
          <div className="absolute top-1.5 w-1 h-1 bg-[#10b981] rounded-full"></div>
          <Home className="w-[20px] h-[20px] text-[#10b981] fill-[#10b981]/20 mt-1" strokeWidth={2} />
          <span className="text-[10px] font-medium text-[#10b981]">Home</span>
        </button>

        {/* Map */}
        <button className="flex-1 h-full flex flex-col items-center justify-center gap-1 text-[#484f58] hover:text-[#8b949e] transition-colors">
          <MapIcon className="w-[20px] h-[20px] mt-1" strokeWidth={2} />
          <span className="text-[10px] font-medium">Map</span>
        </button>

        {/* Center Record Button */}
        <div className="flex-1 h-full flex justify-center relative">
          <button className="absolute -top-4 w-[48px] h-[48px] bg-[#10b981] hover:bg-[#10b981]/90 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all active:scale-95 border-4 border-[#0d1117]">
            <Plus className="w-[24px] h-[24px] text-white" strokeWidth={2.5} />
          </button>
        </div>

        {/* Actions */}
        <button className="flex-1 h-full flex flex-col items-center justify-center gap-1 text-[#484f58] hover:text-[#8b949e] transition-colors">
          <CheckSquare className="w-[20px] h-[20px] mt-1" strokeWidth={2} />
          <span className="text-[10px] font-medium">Actions</span>
        </button>

        {/* More */}
        <button className="flex-1 h-full flex flex-col items-center justify-center gap-1 text-[#484f58] hover:text-[#8b949e] transition-colors">
          <MoreHorizontal className="w-[20px] h-[20px] mt-1" strokeWidth={2} />
          <span className="text-[10px] font-medium">More</span>
        </button>

      </nav>

    </div>
  );
}
