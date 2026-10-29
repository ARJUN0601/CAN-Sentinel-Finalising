import React from 'react';
import { ActiveTab } from '../types/can';
import { Download, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onDownloadAll: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onDownloadAll,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-4 bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <span className="text-base font-bold tracking-tight text-white">
          CAN-Sentinel
        </span>
      </div>

      {/* Zone 2: Clean single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
        <button
          onClick={() => onTabChange('architecture')}
          className={`whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'architecture'
              ? 'text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Pipeline Architecture
        </button>
        <button
          onClick={() => onTabChange('binary')}
          className={`whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'binary'
              ? 'text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Binary Spec & Wire Format
        </button>
        <button
          onClick={() => onTabChange('code')}
          className={`whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'code'
              ? 'text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Source Code Deliverables
        </button>
        <button
          onClick={() => onTabChange('simulator')}
          className={`whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'simulator'
              ? 'text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Live Ingress Simulator
        </button>
        <button
          onClick={() => onTabChange('guide')}
          className={`whitespace-nowrap shrink-0 transition-colors ${
            activeTab === 'guide'
              ? 'text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Verification Guide
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onDownloadAll}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download .ZIP Archive</span>
        </button>
      </div>
    </header>
  );
};
