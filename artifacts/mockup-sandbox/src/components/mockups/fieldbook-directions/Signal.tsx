import React from 'react';
import { 
  Bell, 
  AlertTriangle, 
  ArrowUp, 
  Clock, 
  Activity, 
  Plus, 
  CheckSquare, 
  MapPin, 
  Home,
  Map as MapIcon,
  MoreHorizontal
} from 'lucide-react';

export default function Signal() {
  return (
    <div className="min-h-screen w-[390px] mx-auto bg-[#f1f5f9] font-['Inter'] relative pb-[60px]">
      {/* 1. Status bar area + Top header */}
      <header className="bg-[#ffffff] shadow-sm sticky top-0 z-50 h-[56px] px-4 flex justify-between items-center">
        <div className="flex items-center">
          <div className="w-[30px] h-[30px] rounded-lg bg-[#15803d] flex items-center justify-center">
            <span className="text-white font-[700] text-[16px]">B</span>
          </div>
          <span className="font-[600] text-[16px] text-[#0f172a] ml-2.5">Fieldbook</span>
          <span className="text-[#16a34a] mx-1.5 font-bold">·</span>
          <span className="text-[14px] text-[#475569]">Blickling</span>
        </div>
        <div className="flex items-center">
          <div className="relative">
            <Bell className="text-[#475569]" size={20} />
            <div className="absolute top-0 right-0 w-[6px] h-[6px] bg-[#dc2626] rounded-full border border-white"></div>
          </div>
          <div className="ml-3 w-[32px] h-[32px] rounded-full bg-[#15803d] flex items-center justify-center text-white font-[700] text-[12px]">
            SJ
          </div>
        </div>
      </header>

      {/* 2. Alert + greeting row */}
      <div className="px-4 pt-3 pb-3 bg-white border-b border-[#e2e8f0]">
        <div className="rounded-lg bg-[#fef2f2] border border-[#fca5a5] px-3 py-2.5 flex items-center gap-2">
          <AlertTriangle size={15} className="text-[#dc2626] shrink-0" />
          <span className="font-[500] text-[13px] text-[#dc2626] flex-1">3 urgent observations require action</span>
          <span className="font-[600] text-[12px] text-[#dc2626] underline cursor-pointer">View</span>
        </div>
        
        <div className="mt-2 pt-2 border-t border-[#f1f5f9] flex items-center justify-between">
          <span className="font-[600] text-[15px] text-[#0f172a]">Good morning, Sarah</span>
          <span className="font-[400] text-[12px] text-[#94a3b8]">Thu 17 Jul · 21 open</span>
        </div>
      </div>

      {/* 3. Metric row */}
      <div className="px-4 pt-4 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        <style dangerouslySetInnerHTML={{__html: `
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        `}} />
        
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-3 min-w-[88px] flex-shrink-0 flex flex-col">
          <div className="w-[20px] h-[20px] rounded-md bg-[#fef2f2] flex items-center justify-center">
            <AlertTriangle size={12} className="text-[#dc2626]" />
          </div>
          <span className="font-[800] text-[24px] text-[#dc2626] leading-none mt-2">3</span>
          <span className="font-[400] text-[10px] text-[#94a3b8] mt-1">Urgent</span>
        </div>

        <div className="bg-white rounded-xl border border-[#e2e8f0] p-3 min-w-[88px] flex-shrink-0 flex flex-col">
          <div className="w-[20px] h-[20px] rounded-md bg-[#fff7ed] flex items-center justify-center">
            <ArrowUp size={12} className="text-[#ea580c]" />
          </div>
          <span className="font-[800] text-[24px] text-[#ea580c] leading-none mt-2">8</span>
          <span className="font-[400] text-[10px] text-[#94a3b8] mt-1">High</span>
        </div>

        <div className="bg-white rounded-xl border border-[#e2e8f0] p-3 min-w-[88px] flex-shrink-0 flex flex-col">
          <div className="w-[20px] h-[20px] rounded-md bg-[#fef2f2] flex items-center justify-center">
            <Clock size={12} className="text-[#dc2626]" />
          </div>
          <span className="font-[800] text-[24px] text-[#dc2626] leading-none mt-2">2</span>
          <span className="font-[400] text-[10px] text-[#94a3b8] mt-1">Overdue</span>
        </div>

        <div className="bg-white rounded-xl border border-[#e2e8f0] p-3 min-w-[88px] flex-shrink-0 flex flex-col">
          <div className="w-[20px] h-[20px] rounded-md bg-[#f0fdf4] flex items-center justify-center">
            <Activity size={12} className="text-[#16a34a]" />
          </div>
          <span className="font-[800] text-[24px] text-[#0f172a] leading-none mt-2">21</span>
          <span className="font-[400] text-[10px] text-[#94a3b8] mt-1">Open</span>
        </div>
      </div>

      {/* 4. Quick-action bar */}
      <div className="px-4 mt-2 grid grid-cols-3 gap-2">
        <button className="bg-white rounded-xl border border-[#e2e8f0] p-3 flex flex-col items-center justify-center gap-1.5 shadow-sm">
          <div className="w-[28px] h-[28px] rounded-lg bg-[#f0fdf4] flex items-center justify-center text-[#16a34a]">
            <Plus size={16} />
          </div>
          <span className="font-[500] text-[11px] text-[#0f172a]">New Observation</span>
        </button>
        
        <button className="bg-white rounded-xl border border-[#e2e8f0] p-3 flex flex-col items-center justify-center gap-1.5 shadow-sm">
          <div className="w-[28px] h-[28px] rounded-lg bg-[#eff6ff] flex items-center justify-center text-[#2563eb]">
            <CheckSquare size={16} />
          </div>
          <span className="font-[500] text-[11px] text-[#0f172a]">My Actions</span>
        </button>

        <button className="bg-white rounded-xl border border-[#e2e8f0] p-3 flex flex-col items-center justify-center gap-1.5 shadow-sm">
          <div className="w-[28px] h-[28px] rounded-lg bg-[#fff7ed] flex items-center justify-center text-[#ea580c]">
            <MapPin size={16} />
          </div>
          <span className="font-[500] text-[11px] text-[#0f172a]">View Map</span>
        </button>
      </div>

      {/* 5. Observations — segmented view */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <span className="font-[600] text-[14px] text-[#0f172a]">Observations</span>
          <div className="flex gap-1">
            <button className="px-2.5 py-1 rounded-full bg-[#f0fdf4] text-[#16a34a] border border-[#bbf7d0] font-[500] text-[11px] flex items-center gap-1.5">
              Active <div className="w-1.5 h-1.5 rounded-full bg-[#16a34a]"></div>
            </button>
            <button className="px-2.5 py-1 rounded-full bg-[#f8fafc] text-[#94a3b8] font-[500] text-[11px]">
              Mine
            </button>
            <button className="px-2.5 py-1 rounded-full bg-[#f8fafc] text-[#94a3b8] font-[500] text-[11px]">
              All
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {/* Item 1 */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] px-3 py-3 flex gap-3 shadow-sm items-start">
            <div className="w-1 self-stretch bg-[#dc2626] rounded-full shrink-0"></div>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <span className="font-[500] text-[13px] text-[#0f172a] leading-tight truncate w-full">Fallen oak limb obstructing Lake Walk</span>
              <span className="font-[400] text-[11px] text-[#94a3b8]">📍 Parkland · 3h</span>
            </div>
            <div className="bg-[#fef2f2] text-[#dc2626] rounded-full px-2 py-0.5 text-[10px] font-[500] whitespace-nowrap">
              Action Req
            </div>
          </div>

          {/* Item 2 */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] px-3 py-3 flex gap-3 shadow-sm items-start">
            <div className="w-1 self-stretch bg-[#ea580c] rounded-full shrink-0"></div>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <span className="font-[500] text-[13px] text-[#0f172a] leading-tight truncate w-full">North ha-ha wall erosion — east section</span>
              <span className="font-[400] text-[11px] text-[#94a3b8]">📍 Walled Garden · 1d</span>
            </div>
            <div className="bg-[#fff7ed] text-[#ea580c] rounded-full px-2 py-0.5 text-[10px] font-[500] whitespace-nowrap">
              Review
            </div>
          </div>

          {/* Item 3 */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] px-3 py-3 flex gap-3 shadow-sm items-start">
            <div className="w-1 self-stretch bg-[#ea580c] rounded-full shrink-0"></div>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <span className="font-[500] text-[13px] text-[#0f172a] leading-tight truncate w-full">Footbridge handrail loose — main path</span>
              <span className="font-[400] text-[11px] text-[#94a3b8]">📍 Lake Walk · 2d</span>
            </div>
            <div className="bg-[#eff6ff] text-[#3b82f6] rounded-full px-2 py-0.5 text-[10px] font-[500] whitespace-nowrap">
              Submitted
            </div>
          </div>

          {/* Item 4 */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] px-3 py-3 flex gap-3 shadow-sm items-start">
            <div className="w-1 self-stretch bg-[#3b82f6] rounded-full shrink-0"></div>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <span className="font-[500] text-[13px] text-[#0f172a] leading-tight truncate w-full">Algae growth in north lake margin</span>
              <span className="font-[400] text-[11px] text-[#94a3b8]">📍 Parkland Lake · 3d</span>
            </div>
            <div className="bg-[#f8fafc] text-[#64748b] rounded-full px-2 py-0.5 text-[10px] font-[500] whitespace-nowrap">
              Draft
            </div>
          </div>
        </div>
      </div>

      {/* 6. Bottom navigation */}
      <div className="fixed bottom-0 w-[390px] h-[60px] bg-white border-t border-[#e2e8f0] grid grid-cols-5 z-50">
        <button className="flex flex-col items-center justify-center gap-0.5 relative pb-1 pt-1">
          <div className="absolute top-0 w-[24px] h-[3px] bg-[#16a34a] rounded-b-full"></div>
          <Home className="text-[#16a34a] fill-[#16a34a] mt-1" size={22} />
          <span className="text-[10px] text-[#16a34a] font-[600]">Home</span>
        </button>

        <button className="flex flex-col items-center justify-center gap-0.5 pb-1 pt-1">
          <MapIcon className="text-[#94a3b8]" size={22} />
          <span className="text-[10px] text-[#94a3b8] font-[500]">Map</span>
        </button>

        <div className="flex justify-center items-start">
          <button className="w-[44px] h-[44px] rounded-full bg-[#16a34a] shadow-lg flex items-center justify-center -translate-y-[16px] text-white">
            <Plus size={20} strokeWidth={3} />
          </button>
        </div>

        <button className="flex flex-col items-center justify-center gap-0.5 pb-1 pt-1">
          <CheckSquare className="text-[#94a3b8]" size={22} />
          <span className="text-[10px] text-[#94a3b8] font-[500]">Actions</span>
        </button>

        <button className="flex flex-col items-center justify-center gap-0.5 pb-1 pt-1">
          <MoreHorizontal className="text-[#94a3b8]" size={22} />
          <span className="text-[10px] text-[#94a3b8] font-[500]">More</span>
        </button>
      </div>
    </div>
  );
}
