import React, { useState } from 'react';
import { Search, Bell, Settings, ChevronDown, ChevronRight, TrendingUp, DollarSign, Users, FileText, BarChart3, Award, AlertCircle, MapPin, Calendar, Eye, Edit, Building2, Sparkles, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function ConstructionCRMPremium() {
  const [activeTab, setActiveTab] = useState('prehled');

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      
      {/* Sidebar */}
      <div className="w-64 bg-slate-900/80 backdrop-blur-xl border-r border-slate-800/50 flex flex-col shadow-2xl">
        
        {/* Logo */}
        <div className="p-6 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L4 6V12C4 16.5 7 20.5 12 22C17 20.5 20 16.5 20 12V6L12 2Z" fill="white" opacity="0.95"/>
              </svg>
            </div>
            <div>
              <div className="font-bold text-white text-lg">Construction CRM</div>
              <div className="text-xs text-slate-400">Stavební divize</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <a href="#" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 rounded-xl text-slate-300 transition-all">
            <BarChart3 className="w-5 h-5" />
            <span>Dashboard</span>
          </a>

          <div className="pt-2">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stavby</span>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </div>
            
            <a href="#" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 rounded-xl text-slate-400 transition-all ml-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-sm">Vzorový Projekt RD</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-orange-500/10 to-transparent border-l-2 border-orange-500 text-orange-300 transition-all ml-2">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <span className="text-sm font-medium">REKO Bazén Aš</span>
            </a>
          </div>

          <a href="#" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 rounded-xl text-slate-300 transition-all">
            <Users className="w-5 h-5" />
            <span>Subdodavatelé</span>
          </a>

          <a href="#" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 rounded-xl text-slate-300 transition-all">
            <FileText className="w-5 h-5" />
            <span>Správa staveb</span>
          </a>

          <a href="#" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 rounded-xl text-slate-300 transition-all">
            <Settings className="w-5 h-5" />
            <span>Nastavení</span>
          </a>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-slate-800/50">
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800/70 transition-all cursor-pointer">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center font-bold shadow-lg">
              MK
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Martin Kalkuš</div>
              <div className="text-xs text-slate-400">Admin</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header */}
        <header className="bg-slate-900/50 backdrop-blur-xl border-b border-slate-800/50 px-8 py-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">REKO Bazén Aš</h1>
                <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-xs font-semibold text-emerald-400">Aktivní</span>
              </div>
              <p className="text-slate-400 text-sm">Detail stavby</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  className="pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50 focus:bg-slate-800/70 transition-all w-64"
                />
              </div>
              <button className="p-2.5 hover:bg-slate-800/50 rounded-xl transition-all relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-6">
            {['Přehled', 'Pipelines', 'Dokumenty'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase())}
                className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                  activeTab === tab.toLowerCase()
                    ? 'bg-slate-800 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8">
          
          {/* Top Stats - Premium Cards */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            <div className="group relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition-all overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl border border-blue-500/20 shadow-lg shadow-blue-500/10">
                    <DollarSign className="w-6 h-6 text-blue-400" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Rozpočet (Investor)</div>
                <div className="text-3xl font-bold mb-1">166 547 570 Kč</div>
                <div className="text-xs text-slate-500">Příjem (SOD + Dodatky)</div>
                <div className="mt-4 h-1 bg-slate-700/50 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" style={{width: '100%'}}></div>
                </div>
              </div>
            </div>

            <div className="group relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition-all overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
                    <BarChart3 className="w-6 h-6 text-indigo-400" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Plánovaný náklad</div>
                <div className="text-3xl font-bold mb-1">104 103 835 Kč</div>
                <div className="text-xs text-slate-500">Interní cíl nákladů</div>
                <div className="mt-4 h-1 bg-slate-700/50 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full" style={{width: '62%'}}></div>
                </div>
              </div>
            </div>

            <div className="group relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition-all overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Zasmluvněno (Realita)</div>
                <div className="text-3xl font-bold text-emerald-400 mb-1">3 198 362 Kč</div>
                <div className="text-xs text-emerald-400">Zbývá zadat: +100 905 473 Kč</div>
                <div className="mt-4 h-1 bg-slate-700/50 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{width: '3%'}}></div>
                </div>
              </div>
            </div>

            <div className="group relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition-all overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                    <Sparkles className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
                <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Postup Zadávání</div>
                <div className="text-3xl font-bold mb-1">2 / 3</div>
                <div className="text-xs text-slate-500">Hotové subdodávky</div>
                <div className="mt-4 h-1 bg-slate-700/50 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{width: '67%'}}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Přehled Poptávek - Premium Design */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 mb-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <FileText className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold">Přehled Poptávek (3)</h2>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* Card 1 */}
              <div className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-xl p-6 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/5 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold text-lg">Ocelová konstrukce terasy</h3>
                  <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-xs font-semibold text-blue-400">OTEVŘENÁ</span>
                </div>
                
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Cena SOD:</span>
                    <span className="font-semibold">1 394 936 Kč</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Interní plán:</span>
                    <span className="font-semibold">1 132 518 Kč</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Vysoutěženo:</span>
                    <span className="font-semibold text-emerald-400">1 372 864 Kč</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-700/50">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-emerald-400">✓ Strojarvis Homolka</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Bilance SOD:</span>
                    <span className="text-emerald-400 font-semibold">+22 870 Kč</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Bilance Plán:</span>
                    <span className="text-red-400 font-semibold">-239 558 Kč</span>
                  </div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-xl p-6 hover:border-blue-500/30 hover:shadow-xl hover:shadow-blue-500/5 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold text-lg">Malby</h3>
                  <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-xs font-semibold text-blue-400">OTEVŘENÁ</span>
                </div>
                
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Cena SOD:</span>
                    <span className="font-semibold">667 535 Kč</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Interní plán:</span>
                    <span className="font-semibold">792 963 Kč</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Users className="w-4 h-4" />
                    <span>4 nabídky</span>
                  </div>
                </div>
              </div>

              {/* Card 3 */}
              <div className="group bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-xl p-6 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/5 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold text-lg">Obklady a dlažby (materiál)</h3>
                  <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-xs font-semibold text-blue-400">OTEVŘENÁ</span>
                </div>
                
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Cena SOD:</span>
                    <span className="font-semibold">2 588 849 Kč</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Interní plán:</span>
                    <span className="font-semibold">2 078 964 Kč</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Vysoutěženo:</span>
                    <span className="font-semibold text-emerald-400">1 826 296 Kč</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-700/50">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-emerald-400">✓ Agrob Buchtal (Ceramobjekt)</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Bilance SOD:</span>
                    <span className="text-emerald-400 font-semibold">+724 553 Kč</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Bilance Plán:</span>
                    <span className="text-emerald-400 font-semibold">+244 668 Kč</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section - 3 Columns */}
          <div className="grid grid-cols-3 gap-6">
            {/* Information */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Informace o stavbě</h3>
                <button className="p-2 hover:bg-slate-700/50 rounded-lg transition-all">
                  <Edit className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-xs text-slate-400 mb-1">Investor</div>
                    <div className="font-medium">Město Aš</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                  <Eye className="w-5 h-5 text-violet-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-xs text-slate-400 mb-1">Technický dozor</div>
                    <div className="font-medium">Ing. Plachý</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                  <MapPin className="w-5 h-5 text-emerald-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-xs text-slate-400 mb-1">Lokace</div>
                    <div className="font-medium">Aš</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                  <Calendar className="w-5 h-5 text-orange-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-xs text-slate-400 mb-1">Termín dokončení</div>
                    <div className="font-medium">—</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contract */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Smlouva s investorem</h3>
                <button className="p-2 hover:bg-slate-700/50 rounded-lg transition-all">
                  <Edit className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Základní SOD</span>
                  <span className="font-semibold">129 799 817 Kč</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Dodatek č.1</span>
                  <span className="font-semibold">6 324 848 Kč</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Dodatek č.2</span>
                  <span className="font-semibold">4 811 977 Kč</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Dodatek č.3</span>
                  <span className="font-semibold">20 001 781 Kč</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Dodatek č.4</span>
                  <span className="font-semibold">5 609 145 Kč</span>
                </div>
              </div>
            </div>

            {/* Parameters */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Parametry smlouvy</h3>
                <button className="p-2 hover:bg-slate-700/50 rounded-lg transition-all">
                  <Edit className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Splatnost</span>
                  <span className="font-semibold">30 dní</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Záruka</span>
                  <span className="font-semibold">60 měsíců</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Pozastávka</span>
                  <span className="font-semibold">5+5 %</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Zařízení staveniště</span>
                  <span className="font-semibold">1,4 %</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                  <span className="text-slate-400 text-sm">Podíl na pojištění</span>
                  <span className="font-semibold">0.4 %</span>
                </div>
              </div>
            </div>
          </div>

        </main>
      </div>

    </div>
  );
}