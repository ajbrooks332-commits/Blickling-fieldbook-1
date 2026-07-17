import React from 'react';
import { Bell, AlertTriangle, MapPin, Home, Map as MapIcon, CheckSquare, MoreHorizontal, Plus } from 'lucide-react';

export default function Chalk() {
  return (
    <div className="min-h-[100dvh] w-[390px] mx-auto bg-[#faf7f2] font-['DM_Sans'] text-[#1a1a17] pb-[84px] relative shadow-2xl overflow-hidden">
      {/* Top Header */}
      <header className="bg-[#ffffff] border-b border-[#ede8e0] h-16 px-5 flex justify-between items-center relative z-10">
        {/* Left: Estate Crest */}
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-[#1c3829] flex items-center justify-center shadow-sm">
            <span className="font-['Cormorant_Garamond'] italic text-white text-[18px] leading-none mt-0.5">B</span>
          </div>
          <span className="font-['Cormorant_Garamond'] font-semibold italic text-[#1c3829] text-[18px] ml-3">
            Blickling Estate
          </span>
        </div>
        
        {/* Right: Notifications & Profile */}
        <div className="flex items-center ml-auto">
          <div className="relative">
            <Bell className="text-[#6b5e4a] w-5 h-5" />
            <div className="absolute -top-0.5 -right-0.5 w-[7px] h-[7px] bg-[#c0392b] rounded-full border border-white"></div>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#1c3829] text-white flex items-center justify-center font-medium text-[12px] ml-3 shadow-sm">
            SJ
          </div>
        </div>
      </header>

      {/* Welcome Section */}
      <div className="px-5 pt-5 pb-4 border-b border-[#ede8e0] bg-[#faf7f2]">
        <div className="text-[#a89880] text-[10px] font-medium tracking-widest uppercase">
          THURSDAY, 17 JULY 2026
        </div>
        <h1 className="font-['Cormorant_Garamond'] font-semibold text-[32px] leading-[1.1] text-[#1c3829] mt-2">
          Good morning,<br />Sarah.
        </h1>
        <p className="text-[#6b5e4a] text-[13px] mt-1">
          Blickling Estate, Norfolk — 21 active records
        </p>
      </div>

      {/* Priority Alert */}
      <div className="mx-5 mt-4 bg-[#f5eddc] border border-[#9a6e2a]/30 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
        <AlertTriangle className="w-[16px] h-[16px] text-[#9a6e2a] shrink-0" />
        <span className="text-[#6b5e4a] text-[13px] font-medium flex-1 leading-snug">
          3 urgent issues require your attention today
        </span>
        <button className="text-[#9a6e2a] text-[12px] font-semibold shrink-0 hover:text-[#7a5721] transition-colors">
          Review &rarr;
        </button>
      </div>

      {/* KPI Tiles */}
      <div className="px-5 mt-5 grid grid-cols-2 gap-3">
        {/* Tile 1 */}
        <div className="bg-[#ffffff] border border-[#ede8e0] rounded-2xl px-4 py-4 relative overflow-hidden shadow-sm">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#c0392b]"></div>
          <div className="absolute bottom-1 right-2 opacity-[0.03] font-['Cormorant_Garamond'] italic text-[48px] leading-none pointer-events-none select-none">B</div>
          <div className="font-['Cormorant_Garamond'] font-bold text-[36px] text-[#c0392b] leading-none mb-1">3</div>
          <div className="h-[1px] w-full bg-[#ede8e0] mb-2 mt-2"></div>
          <div className="text-[#a89880] text-[11px] font-medium">Urgent</div>
          <div className="text-[#a89880] text-[9px] uppercase tracking-wider mt-0.5">Issues</div>
        </div>

        {/* Tile 2 */}
        <div className="bg-[#ffffff] border border-[#ede8e0] rounded-2xl px-4 py-4 relative overflow-hidden shadow-sm">
          <div className="absolute bottom-1 right-2 opacity-[0.03] font-['Cormorant_Garamond'] italic text-[48px] leading-none pointer-events-none select-none">B</div>
          <div className="font-['Cormorant_Garamond'] font-bold text-[36px] text-[#e07b1a] leading-none mb-1">8</div>
          <div className="h-[1px] w-full bg-[#ede8e0] mb-2 mt-2"></div>
          <div className="text-[#a89880] text-[11px] font-medium">High Priority</div>
          <div className="text-[#a89880] text-[9px] uppercase tracking-wider mt-0.5">Issues</div>
        </div>

        {/* Tile 3 */}
        <div className="bg-[#ffffff] border border-[#ede8e0] rounded-2xl px-4 py-4 relative overflow-hidden shadow-sm">
          <div className="absolute bottom-1 right-2 opacity-[0.03] font-['Cormorant_Garamond'] italic text-[48px] leading-none pointer-events-none select-none">B</div>
          <div className="font-['Cormorant_Garamond'] font-bold text-[36px] text-[#c0392b] leading-none mb-1">2</div>
          <div className="h-[1px] w-full bg-[#ede8e0] mb-2 mt-2"></div>
          <div className="text-[#a89880] text-[11px] font-medium">Overdue</div>
          <div className="text-[#a89880] text-[9px] uppercase tracking-wider mt-0.5">Actions</div>
        </div>

        {/* Tile 4 */}
        <div className="bg-[#ffffff] border border-[#ede8e0] rounded-2xl px-4 py-4 relative overflow-hidden shadow-sm">
          <div className="absolute bottom-1 right-2 opacity-[0.03] font-['Cormorant_Garamond'] italic text-[48px] leading-none pointer-events-none select-none">B</div>
          <div className="font-['Cormorant_Garamond'] font-bold text-[36px] text-[#1c3829] leading-none mb-1">21</div>
          <div className="h-[1px] w-full bg-[#ede8e0] mb-2 mt-2"></div>
          <div className="text-[#a89880] text-[11px] font-medium">Open Records</div>
          <div className="text-[#a89880] text-[9px] uppercase tracking-wider mt-0.5">Total</div>
        </div>
      </div>

      {/* This Week Section */}
      <div className="px-5 mt-8 mb-6">
        <div className="flex justify-between items-baseline mb-1">
          <h2 className="font-['Cormorant_Garamond'] font-semibold text-[22px] text-[#1c3829]">This Week</h2>
          <button className="text-[#9a6e2a] text-[12px] font-medium hover:text-[#7a5721] transition-colors">
            View all
          </button>
        </div>
        <p className="text-[#a89880] text-[12px] mb-4">Observations requiring attention</p>

        <div className="flex flex-col">
          {/* Item 1 */}
          <div className="py-3.5 border-b border-[#ede8e0]">
            <div className="flex justify-between items-start mb-1.5">
              <span className="text-[#1a1a17] text-[14px] font-medium pr-3 leading-snug">Fallen oak limb obstructing Lake Walk</span>
              <span className="bg-[#fdf2f2] text-[#c0392b] px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 tracking-wide">URGENT</span>
            </div>
            <div className="flex items-center text-[#6b5e4a] text-[12px]">
              <MapPin className="w-[11px] h-[11px] mr-1.5 shrink-0" />
              <span>Parkland</span>
              <span className="mx-1.5 text-[#a89880]">&middot;</span>
              <span className="text-[#a89880] text-[11px]">3h ago</span>
            </div>
          </div>

          {/* Item 2 */}
          <div className="py-3.5 border-b border-[#ede8e0]">
            <div className="flex justify-between items-start mb-1.5">
              <span className="text-[#1a1a17] text-[14px] font-medium pr-3 leading-snug">North ha-ha wall erosion &mdash; east section</span>
              <span className="bg-[#fef3e8] text-[#e07b1a] px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 tracking-wide">HIGH</span>
            </div>
            <div className="flex items-center text-[#6b5e4a] text-[12px]">
              <MapPin className="w-[11px] h-[11px] mr-1.5 shrink-0" />
              <span>Walled Garden</span>
              <span className="mx-1.5 text-[#a89880]">&middot;</span>
              <span className="text-[#a89880] text-[11px]">1d ago</span>
            </div>
          </div>

          {/* Item 3 */}
          <div className="py-3.5 border-b border-[#ede8e0]">
            <div className="flex justify-between items-start mb-1.5">
              <span className="text-[#1a1a17] text-[14px] font-medium pr-3 leading-snug">Footbridge handrail loose &mdash; main path</span>
              <span className="bg-[#fef3e8] text-[#e07b1a] px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 tracking-wide">HIGH</span>
            </div>
            <div className="flex items-center text-[#6b5e4a] text-[12px]">
              <MapPin className="w-[11px] h-[11px] mr-1.5 shrink-0" />
              <span>Lake Walk</span>
              <span className="mx-1.5 text-[#a89880]">&middot;</span>
              <span className="text-[#a89880] text-[11px]">2d ago</span>
            </div>
          </div>

          {/* Item 4 */}
          <div className="py-3.5">
            <div className="flex justify-between items-start mb-1.5">
              <span className="text-[#1a1a17] text-[14px] font-medium pr-3 leading-snug">Algae growth in north lake margin</span>
              <span className="bg-[#eff6ff] text-[#2c6e97] px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 tracking-wide">NORMAL</span>
            </div>
            <div className="flex items-center text-[#6b5e4a] text-[12px]">
              <MapPin className="w-[11px] h-[11px] mr-1.5 shrink-0" />
              <span>Parkland Lake</span>
              <span className="mx-1.5 text-[#a89880]">&middot;</span>
              <span className="text-[#a89880] text-[11px]">3d ago</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 w-full bg-[#ffffff] border-t border-[#ede8e0] h-[84px] px-2 pb-5 flex items-center justify-between z-20 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] rounded-b-[inherit]">
        <button className="flex-1 flex flex-col items-center justify-center gap-1 relative h-full group">
          <div className="absolute top-0 w-6 h-[2px] bg-[#9a6e2a]"></div>
          <Home className="w-5 h-5 text-[#1c3829] fill-[#1c3829] mt-2 group-hover:scale-110 transition-transform" />
          <span className="text-[#1c3829] text-[10px] font-medium">Dashboard</span>
        </button>
        <button className="flex-1 flex flex-col items-center justify-center gap-1 h-full mt-2 group">
          <MapIcon className="w-5 h-5 text-[#a89880] group-hover:text-[#1c3829] transition-colors" />
          <span className="text-[#a89880] text-[10px] font-medium group-hover:text-[#1c3829] transition-colors">Map</span>
        </button>
        
        {/* Floating Action Button */}
        <div className="flex-1 flex justify-center -mt-10 relative z-30">
          <button className="w-12 h-12 rounded-full bg-[#1c3829] flex items-center justify-center shadow-md shadow-[#1c3829]/20 text-white hover:bg-[#2d5a3d] transition-colors transform hover:scale-105 active:scale-95 border border-[#2d5a3d]">
            <Plus className="w-6 h-6" />
          </button>
        </div>
        
        <button className="flex-1 flex flex-col items-center justify-center gap-1 h-full mt-2 group">
          <CheckSquare className="w-5 h-5 text-[#a89880] group-hover:text-[#1c3829] transition-colors" />
          <span className="text-[#a89880] text-[10px] font-medium group-hover:text-[#1c3829] transition-colors">Actions</span>
        </button>
        <button className="flex-1 flex flex-col items-center justify-center gap-1 h-full mt-2 group">
          <MoreHorizontal className="w-5 h-5 text-[#a89880] group-hover:text-[#1c3829] transition-colors" />
          <span className="text-[#a89880] text-[10px] font-medium group-hover:text-[#1c3829] transition-colors">More</span>
        </button>
      </div>
    </div>
  );
}
