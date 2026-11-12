import React, { useState, useMemo } from 'react';
import { DecodedCanFrame } from '../types/can';
import {
  Trash2,
  Search,
  Filter,
  Copy,
  Check,
  PauseCircle,
  PlayCircle,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  Download,
  FileText,
  Clock,
  Cpu,
  Hash,
  Database,
  X
} from 'lucide-react';

export type SearchFieldMode = 'all' | 'payload' | 'timestamp' | 'id';

interface MessageLogProps {
  packets: DecodedCanFrame[];
  onClearHistory: () => void;
  pythonServerOnline?: boolean;
  idFilterList?: number[];
  idFilterMode?: 'show' | 'hide';
  onClearIdFilter?: () => void;
  onExportCsv?: () => void;
}

// Helper to highlight matching substrings safely
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <span>{text}</span>;

  const cleanQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${cleanQuery})`, 'gi'));

  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
          <mark
            key={i}
            className="bg-amber-400/30 text-amber-200 px-0.5 rounded border border-amber-400/50 font-bold"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export const MessageLog: React.FC<MessageLogProps> = ({
  packets,
  onClearHistory,
  pythonServerOnline = true,
  idFilterList = [],
  idFilterMode = 'show',
  onClearIdFilter,
  onExportCsv,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchFieldMode, setSearchFieldMode] = useState<SearchFieldMode>('all');
  const [filterType, setFilterType] = useState<'all' | 'normal' | 'anomaly'>('all');
  const [pauseAutoScroll, setPauseAutoScroll] = useState<boolean>(false);
  const [expandedPacketId, setExpandedPacketId] = useState<number | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Filtered packets based on full-text search, field mode, anomaly filters, and CAN ID filter
  const filteredPackets = useMemo(() => {
    return packets.filter((pkt) => {
      // 1. External CAN Packet ID filter from SimulatorView
      if (idFilterList && idFilterList.length > 0) {
        const matches = idFilterList.includes(pkt.canId);
        if (idFilterMode === 'show' && !matches) return false;
        if (idFilterMode === 'hide' && matches) return false;
      }

      // 2. Filter by anomaly category
      const isAnyAnomaly = pkt.isAnomaly || pkt.isPotentialAnomaly;
      if (filterType === 'normal' && isAnyAnomaly) return false;
      if (filterType === 'anomaly' && !isAnyAnomaly) return false;

      // 3. Full-Text Search Filtering
      if (!searchTerm.trim()) return true;

      const rawQuery = searchTerm.trim().toLowerCase();
      const strippedQuery = rawQuery.replace(/\s+/g, '');

      // Prepare searchable fields
      const hexId = `0x${pkt.canId.toString(16).toLowerCase()}`;
      const decId = pkt.canId.toString();

      // Payload strings
      const payloadBytes = pkt.data.slice(0, pkt.dlc);
      const spacedHexPayload = payloadBytes
        .map((b) => b.toString(16).padStart(2, '0').toLowerCase())
        .join(' ');
      const rawHexPayload = payloadBytes
        .map((b) => b.toString(16).padStart(2, '0').toLowerCase())
        .join('');
      const asciiPayload = payloadBytes
        .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
        .join('')
        .toLowerCase();

      // Timestamps
      const timestampStr = pkt.timestampUs.toString();
      const deltaStr = pkt.deltaUs.toString();
      const deltaWithUnit = `+${pkt.deltaUs}µs`.toLowerCase();

      // Telemetry
      const signalName = (pkt.signalName || '').toLowerCase();
      const decodedValue = (pkt.decodedValue || '').toLowerCase();
      const anomalyReason = (pkt.anomalyReason || '').toLowerCase();

      // Match based on selected search field mode
      if (searchFieldMode === 'payload') {
        return (
          spacedHexPayload.includes(rawQuery) ||
          rawHexPayload.includes(strippedQuery) ||
          payloadBytes.some((b) => `0x${b.toString(16).toLowerCase()}` === rawQuery) ||
          payloadBytes.some((b) => b.toString(16).toLowerCase() === rawQuery) ||
          asciiPayload.includes(rawQuery)
        );
      }

      if (searchFieldMode === 'timestamp') {
        return (
          timestampStr.includes(rawQuery) ||
          deltaStr.includes(rawQuery) ||
          deltaWithUnit.includes(rawQuery)
        );
      }

      if (searchFieldMode === 'id') {
        return (
          hexId.includes(rawQuery) ||
          decId.includes(rawQuery) ||
          pkt.canId.toString(16).toLowerCase() === rawQuery
        );
      }

      // 'all' field search: search across payload, timestamps, ID, signals, and anomalies
      return (
        spacedHexPayload.includes(rawQuery) ||
        rawHexPayload.includes(strippedQuery) ||
        payloadBytes.some((b) => `0x${b.toString(16).toLowerCase()}` === rawQuery) ||
        asciiPayload.includes(rawQuery) ||
        timestampStr.includes(rawQuery) ||
        deltaStr.includes(rawQuery) ||
        deltaWithUnit.includes(rawQuery) ||
        hexId.includes(rawQuery) ||
        decId.includes(rawQuery) ||
        signalName.includes(rawQuery) ||
        decodedValue.includes(rawQuery) ||
        anomalyReason.includes(rawQuery)
      );
    });
  }, [packets, searchTerm, searchFieldMode, filterType, idFilterList, idFilterMode]);

  const handleCopyLog = () => {
    if (packets.length === 0) return;
    const header =
      'ID,TimestampUs,DeltaUs,CanIdHex,Type,DLC,PayloadHex,Signal,DecodedValue,Anomaly,PotentialAnomaly,AnomalyReason\n';
    const rows = packets
      .map((p) => {
        const hexPayload = p.data
          .slice(0, p.dlc)
          .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
          .join(' ');
        return `${p.id},${p.timestampUs},${p.deltaUs},0x${p.canId
          .toString(16)
          .toUpperCase()},${p.isExtended ? 'EFF' : 'SFF'},${p.dlc},"${hexPayload}","${
          p.signalName || ''
        }","${p.decodedValue || ''}",${p.isAnomaly ? 'YES' : 'NO'},${
          p.isPotentialAnomaly ? 'POTENTIAL_ANOMALY' : 'NORMAL'
        },"${p.anomalyReason || ''}"`;
      })
      .join('\n');

    navigator.clipboard.writeText(header + rows);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleExpand = (id: number) => {
    setExpandedPacketId((prev) => (prev === id ? null : id));
  };

  const handleQuickSearch = (query: string, mode: SearchFieldMode = 'all') => {
    setSearchTerm(query);
    setSearchFieldMode(mode);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-850 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Recent CAN Packet Message Log
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
                {packets.length} captured
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Low-level ingress buffer with full-text payload & timestamp search and forensic export
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Pause Auto-scroll button */}
          <button
            onClick={() => setPauseAutoScroll(!pauseAutoScroll)}
            title={pauseAutoScroll ? 'Resume live update stream' : 'Pause stream to review history'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              pauseAutoScroll
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300'
            }`}
          >
            {pauseAutoScroll ? (
              <>
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Resume View</span>
              </>
            ) : (
              <>
                <PauseCircle className="w-3.5 h-3.5" />
                <span>Pause View</span>
              </>
            )}
          </button>

          {/* Export CSV File Button */}
          {onExportCsv && (
            <button
              onClick={onExportCsv}
              disabled={packets.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-emerald-500/30 transition-all cursor-pointer shadow-xs"
              title="Export current message log history to CSV file format for forensic analysis"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          )}

          {/* Copy CSV to Clipboard */}
          <button
            onClick={handleCopyLog}
            disabled={packets.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-slate-700 transition-colors cursor-pointer"
            title="Copy CSV to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy CSV</span>
              </>
            )}
          </button>

          {/* Clear History Button */}
          <button
            onClick={onClearHistory}
            disabled={packets.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-rose-500/30 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Full-Text Search and Filter Control Bar */}
      <div className="p-4 bg-slate-900/95 border-b border-slate-800 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input with Target Scope Selector */}
          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  searchFieldMode === 'payload'
                    ? 'Search data payloads (e.g. 00 00, 11 22, FF 00, AA)...'
                    : searchFieldMode === 'timestamp'
                    ? 'Search timestamps (e.g. 171802, +25µs, 50)...'
                    : searchFieldMode === 'id'
                    ? 'Search CAN IDs (e.g. 0x280, 0x000, 284)...'
                    : 'Full-text search: data payload bytes, timestamp (µs), CAN ID, signal...'
                }
                className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg text-slate-100 placeholder-slate-500 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Field Scope Selector */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-mono shrink-0">
              <button
                onClick={() => setSearchFieldMode('all')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  searchFieldMode === 'all'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Search across all fields"
              >
                All Fields
              </button>
              <button
                onClick={() => setSearchFieldMode('payload')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  searchFieldMode === 'payload'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Search specifically within 8-byte data payloads"
              >
                <Database className="w-3 h-3" />
                <span>Payload</span>
              </button>
              <button
                onClick={() => setSearchFieldMode('timestamp')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  searchFieldMode === 'timestamp'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Search specifically within microsecond timestamps & deltas"
              >
                <Clock className="w-3 h-3" />
                <span>Timestamp</span>
              </button>
              <button
                onClick={() => setSearchFieldMode('id')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  searchFieldMode === 'id'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Search specifically within CAN IDs"
              >
                <Hash className="w-3 h-3" />
                <span>CAN ID</span>
              </button>
            </div>
          </div>

          {/* Anomaly Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 self-start lg:self-auto">
            <span className="text-slate-400 text-[11px] flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3" /> Category:
            </span>
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                filterType === 'all'
                  ? 'bg-slate-800 text-slate-100 border border-slate-700 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({packets.length})
            </button>
            <button
              onClick={() => setFilterType('normal')}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                filterType === 'normal'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Normal ({packets.filter((p) => !p.isAnomaly && !p.isPotentialAnomaly).length})
            </button>
            <button
              onClick={() => setFilterType('anomaly')}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                filterType === 'anomaly'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Anomalies ({packets.filter((p) => p.isAnomaly || p.isPotentialAnomaly).length})
            </button>
          </div>
        </div>

        {/* Quick Search Payload & Timestamp Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
          <span className="text-slate-400 flex items-center gap-1">
            <Search className="w-3 h-3 text-cyan-400" />
            <span>Quick Search Filters:</span>
          </span>
          <button
            onClick={() => handleQuickSearch('00 00', 'payload')}
            className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-rose-300 border border-slate-800 font-mono transition-colors cursor-pointer"
          >
            Payload: &quot;00 00&quot; (Flood)
          </button>
          <button
            onClick={() => handleQuickSearch('11 22', 'payload')}
            className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-slate-800 font-mono transition-colors cursor-pointer"
          >
            Payload: &quot;11 22&quot; (RPM)
          </button>
          <button
            onClick={() => handleQuickSearch('FF 00', 'payload')}
            className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-800 font-mono transition-colors cursor-pointer"
          >
            Payload: &quot;FF 00&quot; (Brake)
          </button>
          <button
            onClick={() => handleQuickSearch('55 AA', 'payload')}
            className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-purple-300 border border-slate-800 font-mono transition-colors cursor-pointer"
          >
            Payload: &quot;55 AA&quot; (Unlock)
          </button>
          <button
            onClick={() => handleQuickSearch('0x280', 'id')}
            className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-slate-800 font-mono transition-colors cursor-pointer"
          >
            ID: &quot;0x280&quot;
          </button>
          <button
            onClick={() => handleQuickSearch('0x000', 'id')}
            className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-rose-300 border border-slate-800 font-mono transition-colors cursor-pointer"
          >
            ID: &quot;0x000&quot;
          </button>

          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="ml-auto text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              Clear Search
            </button>
          )}
        </div>

        {/* Search Results Summary Banner */}
        {searchTerm && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-cyan-950/40 border border-cyan-800/50 text-xs font-mono">
            <div className="flex items-center gap-2 text-cyan-300">
              <Search className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                Search active in <strong>{searchFieldMode.toUpperCase()}</strong> mode: &quot;
                {searchTerm}&quot; — matching{' '}
                <strong className="text-white">{filteredPackets.length}</strong> of{' '}
                {packets.length} captured frames (
                {packets.length > 0
                  ? Math.round((filteredPackets.length / packets.length) * 100)
                  : 0}
                %)
              </span>
            </div>
            {filteredPackets.length === 0 && (
              <span className="text-amber-400 text-[11px]">
                No matching packets found in current buffer
              </span>
            )}
          </div>
        )}
      </div>

      {/* Packet Stream & Detail Inspector Table */}
      <div className="overflow-x-auto max-h-[460px] overflow-y-auto divide-y divide-slate-800/60">
        {packets.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-500 mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-300">Message Log is Empty</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Recent CAN packets processed by the simulator will be captured here in real-time.
              Resume simulator ingress or use Step-Forward to generate packets.
            </p>
          </div>
        ) : filteredPackets.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs space-y-2">
            <p>No packets match the current search query &quot;{searchTerm}&quot; in {searchFieldMode} mode.</p>
            <button
              onClick={() => setSearchTerm('')}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs cursor-pointer"
            >
              Reset Search Filter
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/90 text-slate-400 sticky top-0 border-b border-slate-800 z-10 backdrop-blur-xs">
              <tr>
                <th className="py-2 px-3 w-8"></th>
                <th className="py-2 px-3">#</th>
                <th className="py-2 px-3">Timestamp (µs)</th>
                <th className="py-2 px-3">CAN ID</th>
                <th className="py-2 px-3">Format</th>
                <th className="py-2 px-3">DLC</th>
                <th className="py-2 px-3">Payload (Hex Bytes)</th>
                <th className="py-2 px-3">Telemetry / Signal & Badges</th>
                <th className="py-2 px-3">Delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredPackets.map((pkt) => {
                const isExpanded = expandedPacketId === pkt.id;
                const isWarning = pkt.isPotentialAnomaly;
                const isAttack = pkt.isAnomaly && !pkt.isPotentialAnomaly;

                const rowBg = isExpanded
                  ? 'bg-slate-800/70'
                  : isWarning
                  ? 'bg-amber-950/25 hover:bg-amber-950/40 border-l-2 border-l-amber-500'
                  : isAttack
                  ? 'bg-red-950/20 hover:bg-red-950/30'
                  : 'hover:bg-slate-800/40';

                const hexPayloadSpaced = pkt.data
                  .slice(0, pkt.dlc)
                  .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
                  .join(' ');

                const hexIdStr = `0x${pkt.canId.toString(16).toUpperCase().padStart(3, '0')}`;

                return (
                  <React.Fragment key={pkt.id}>
                    <tr
                      onClick={() => toggleExpand(pkt.id)}
                      className={`cursor-pointer transition-colors ${rowBg}`}
                    >
                      <td className="py-2 px-3 text-slate-500">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-500 tabular-nums">{pkt.id}</td>
                      <td className="py-2 px-3 tabular-nums text-slate-400">
                        <HighlightedText
                          text={pkt.timestampUs.toString()}
                          query={searchFieldMode === 'all' || searchFieldMode === 'timestamp' ? searchTerm : ''}
                        />
                        <span className="text-[10px] text-cyan-400 ml-1.5 font-mono">
                          (+{pkt.deltaUs}µs)
                        </span>
                      </td>
                      <td className="py-2 px-3 font-bold text-white">
                        <HighlightedText
                          text={hexIdStr}
                          query={searchFieldMode === 'all' || searchFieldMode === 'id' ? searchTerm : ''}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            pkt.isExtended
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {pkt.isExtended ? 'EFF (29b)' : 'SFF (11b)'}
                        </span>
                      </td>
                      <td className="py-2 px-3 tabular-nums text-amber-400 font-semibold">
                        {pkt.dlc}
                      </td>
                      <td className="py-2 px-3 font-bold text-emerald-300 tracking-wider">
                        <HighlightedText
                          text={hexPayloadSpaced}
                          query={searchFieldMode === 'all' || searchFieldMode === 'payload' ? searchTerm : ''}
                        />
                      </td>
                      <td className="py-2 px-3 font-sans text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Potential Anomaly Badge */}
                          {pkt.isPotentialAnomaly ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 shadow-xs">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>Potential Anomaly</span>
                            </span>
                          ) : pkt.isAnomaly ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0 shadow-xs">
                              <ShieldAlert className="w-3 h-3 text-rose-400" />
                              <span>Anomaly</span>
                            </span>
                          ) : null}

                          <span
                            className={
                              pkt.isPotentialAnomaly
                                ? 'text-amber-200 font-semibold'
                                : pkt.isAnomaly
                                ? 'text-rose-300 font-semibold'
                                : 'text-slate-200'
                            }
                          >
                            <HighlightedText
                              text={pkt.signalName || 'Unknown Signal'}
                              query={searchFieldMode === 'all' ? searchTerm : ''}
                            />
                          </span>
                          {pkt.decodedValue && (
                            <span className="text-slate-400 text-[11px]">
                              (
                              <HighlightedText
                                text={pkt.decodedValue}
                                query={searchFieldMode === 'all' ? searchTerm : ''}
                              />
                              )
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        {pythonServerOnline ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sans">
                            Forwarded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-sans">
                            Dropped
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Packet Detail Drawer */}
                    {isExpanded && (
                      <tr className="bg-slate-950/70 border-b border-slate-800">
                        <td colSpan={9} className="p-4">
                          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                                <Cpu className="w-3.5 h-3.5" />
                                <span>21-Byte Serialized Wire Packet Inspector (Packet #{pkt.id})</span>
                              </div>
                              <span className="text-[11px] font-mono text-slate-400">
                                Raw 32-bit CAN ID: 0x{pkt.rawCanId.toString(16).toUpperCase().padStart(8, '0')}
                              </span>
                            </div>

                            {/* Potential Anomaly Banner Callout in Inspector */}
                            {pkt.isPotentialAnomaly && (
                              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-mono">
                                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                <div>
                                  <span className="font-bold text-amber-300">POTENTIAL ANOMALY DETECTED:</span>{' '}
                                  {pkt.anomalyReason || 'Packet ID is unexpected or matches blacklist rule'}
                                </div>
                              </div>
                            )}

                            {/* Low-Level Byte Breakdown */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                                <span className="text-[10px] text-slate-500 block mb-0.5">Bytes 0..7 (Timestamp)</span>
                                <span className="font-mono text-cyan-300 font-semibold">{pkt.timestampUs} µs</span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">uint64_t little-endian</span>
                              </div>

                              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                                <span className="text-[10px] text-slate-500 block mb-0.5">Bytes 8..11 (CAN ID & Flags)</span>
                                <span className="font-mono text-purple-300 font-semibold">
                                  0x{pkt.canId.toString(16).toUpperCase()} ({pkt.isExtended ? 'EFF' : 'SFF'})
                                </span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  Bit 31: {pkt.isExtended ? '1 (EFF)' : '0 (SFF)'}
                                </span>
                              </div>

                              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                                <span className="text-[10px] text-slate-500 block mb-0.5">Byte 12 (DLC)</span>
                                <span className="font-mono text-amber-300 font-semibold">{pkt.dlc} Bytes</span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">Payload Length</span>
                              </div>

                              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                                <span className="text-[10px] text-slate-500 block mb-0.5">Bytes 13..20 (Data Payload)</span>
                                <span className="font-mono text-emerald-300 font-semibold">
                                  {pkt.data.slice(0, pkt.dlc).map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}
                                </span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">8-Byte Fixed Array</span>
                              </div>
                            </div>

                            {/* Bit Inspection of Payload */}
                            <div className="pt-1">
                              <span className="text-[10px] text-slate-400 block mb-1.5 font-medium">
                                Binary Bitwise Representation (Byte 0 to Byte {pkt.dlc - 1}):
                              </span>
                              <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                                {pkt.data.slice(0, pkt.dlc).map((byte, idx) => (
                                  <div
                                    key={idx}
                                    className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-center"
                                  >
                                    <span className="text-[9px] text-slate-500 block">B{idx}</span>
                                    <span className="text-emerald-400 font-bold">
                                      0x{byte.toString(16).padStart(2, '0').toUpperCase()}
                                    </span>
                                    <span className="text-[9px] text-slate-400 block">
                                      {byte.toString(2).padStart(8, '0')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer Summary Strip */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Showing {filteredPackets.length} of {packets.length} captured frames</span>
          {searchTerm && (
            <span className="text-cyan-400 font-medium ml-1">
              (Filter: &quot;{searchTerm}&quot; in {searchFieldMode})
            </span>
          )}
          {pauseAutoScroll && (
            <span className="text-amber-400 font-medium ml-2">● Auto-scroll paused</span>
          )}
        </div>
        <div className="text-slate-400">
          Click any row to inspect 21-byte wire structure
        </div>
      </div>
    </div>
  );
};
