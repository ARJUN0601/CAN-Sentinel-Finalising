import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DecodedCanFrame, TrafficPreset } from '../types/can';
import {
  Terminal as TerminalIcon,
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Download,
  Search,
  Sliders,
  ShieldAlert,
  AlertTriangle,
  Cpu,
  X
} from 'lucide-react';

export type TuiMode = 'cansniffer' | 'candump';
export type TuiTheme = 'green' | 'amber' | 'cyan' | 'matrix';

interface SnifferRow {
  canId: number;
  hexId: string;
  name: string;
  dlc: number;
  data: number[];
  prevData: number[];
  byteChangedFlags: boolean[];
  lastUpdateTimestamp: number;
  deltaUs: number;
  count: number;
  hz: number;
  thresholdLimit: number;
  isOverThreshold: boolean;
  isAnomaly: boolean;
  isExtended: boolean;
  decodedValue?: string;
}

interface CanTuiViewProps {
  packets: DecodedCanFrame[];
  isRunning: boolean;
  onTogglePause: () => void;
  onStepForward: () => void;
  onClearHistory: () => void;
  onExportCsv?: () => void;
  currentFps: number;
  preset: TrafficPreset;
  onPresetChange: (p: TrafficPreset) => void;
  thresholdRules: Record<number, number>;
  globalThresholdHz: number;
  isSocketCanActive?: boolean;
}

export const CanTuiView: React.FC<CanTuiViewProps> = ({
  packets,
  isRunning,
  onTogglePause,
  onStepForward,
  onClearHistory,
  onExportCsv,
  currentFps,
  preset,
  onPresetChange,
  thresholdRules,
  globalThresholdHz,
  isSocketCanActive = true,
}) => {
  const [tuiMode, setTuiMode] = useState<TuiMode>('cansniffer');
  const [theme, setTheme] = useState<TuiTheme>('green');
  const [tuiSearch, setTuiSearch] = useState<string>('');
  const [cmdInput, setCmdInput] = useState<string>('');
  const [cmdFeedback, setCmdFeedback] = useState<string>('');
  const [uptimeSeconds, setUptimeSeconds] = useState<number>(0);

  // Sniffer ID state: tracks previous payload bytes to achieve true cansniffer byte-diff highlighting
  const previousDataByCanId = useRef<Map<number, number[]>>(new Map());
  const byteChangeTimestamps = useRef<Map<string, number>>(new Map()); // key: `${canId}_${byteIndex}`

  // Track system uptime ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setUptimeSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute aggregated rows for cansniffer mode
  const snifferRows: SnifferRow[] = useMemo(() => {
    const rowsMap = new Map<number, SnifferRow>();
    const now = Date.now();

    // Iterate packets from oldest to newest to build up accurate state
    const chronological = [...packets].reverse();

    chronological.forEach((pkt) => {
      const prevData = previousDataByCanId.current.get(pkt.canId) || [];
      const byteChangedFlags: boolean[] = [];

      for (let i = 0; i < pkt.dlc; i++) {
        const curByte = pkt.data[i] ?? 0;
        const oldByte = prevData[i];
        const key = `${pkt.canId}_${i}`;

        if (oldByte !== undefined && oldByte !== curByte) {
          byteChangeTimestamps.current.set(key, now);
          byteChangedFlags[i] = true;
        } else {
          // Keep highlighted if changed recently (within 1500ms)
          const lastChanged = byteChangeTimestamps.current.get(key) || 0;
          byteChangedFlags[i] = now - lastChanged < 1500;
        }
      }

      previousDataByCanId.current.set(pkt.canId, [...pkt.data]);

      const limit = thresholdRules[pkt.canId] ?? globalThresholdHz;
      // Estimate Hz for this ID based on recent occurrences in buffer
      const recentOccurrences = packets
        .slice(0, 50)
        .filter((p) => p.canId === pkt.canId).length;
      const estimatedHz = Math.round((recentOccurrences / 50) * currentFps);
      const isOverThreshold = estimatedHz > limit;

      rowsMap.set(pkt.canId, {
        canId: pkt.canId,
        hexId: `0x${pkt.canId.toString(16).toUpperCase().padStart(3, '0')}`,
        name: pkt.signalName || `ID 0x${pkt.canId.toString(16).toUpperCase()}`,
        dlc: pkt.dlc,
        data: [...pkt.data],
        prevData,
        byteChangedFlags,
        lastUpdateTimestamp: pkt.timestampUs,
        deltaUs: pkt.deltaUs,
        count: (rowsMap.get(pkt.canId)?.count || 0) + 1,
        hz: estimatedHz,
        thresholdLimit: limit,
        isOverThreshold,
        isAnomaly: !!pkt.isAnomaly || !!pkt.isPotentialAnomaly,
        isExtended: pkt.isExtended,
        decodedValue: pkt.decodedValue,
      });
    });

    const list = Array.from(rowsMap.values()).sort((a, b) => a.canId - b.canId);

    // Apply TUI search filter
    if (!tuiSearch.trim()) return list;
    const q = tuiSearch.toLowerCase().trim();
    return list.filter((r) => {
      const hexPayload = r.data
        .slice(0, r.dlc)
        .map((b) => b.toString(16).padStart(2, '0').toLowerCase())
        .join(' ');
      return (
        r.hexId.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        hexPayload.includes(q) ||
        (r.decodedValue && r.decodedValue.toLowerCase().includes(q))
      );
    });
  }, [packets, currentFps, thresholdRules, globalThresholdHz, tuiSearch]);

  // Filtered stream for candump mode
  const candumpLines = useMemo(() => {
    let list = packets;
    if (tuiSearch.trim()) {
      const q = tuiSearch.toLowerCase().trim();
      list = list.filter((pkt) => {
        const hexId = `0x${pkt.canId.toString(16).toLowerCase()}`;
        const hexPayload = pkt.data
          .slice(0, pkt.dlc)
          .map((b) => b.toString(16).padStart(2, '0').toLowerCase())
          .join(' ');
        const ts = pkt.timestampUs.toString();
        const delta = pkt.deltaUs.toString();
        return (
          hexId.includes(q) ||
          hexPayload.includes(q) ||
          ts.includes(q) ||
          delta.includes(q) ||
          (pkt.signalName && pkt.signalName.toLowerCase().includes(q))
        );
      });
    }
    return list.slice(0, 40);
  }, [packets, tuiSearch]);

  // Format uptime HH:MM:SS
  const formatUptime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m
      .toString()
      .padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Execute terminal console command
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdInput.trim()) return;

    const parts = cmdInput.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg1 = parts[1]?.toLowerCase();

    if (cmd === 'help') {
      setCmdFeedback('Commands: sniffer, dump, pause, resume, step, clear, search <term>, preset <normal|flood|fuzz|replay>, theme <green|amber|cyan>, export');
    } else if (cmd === 'sniffer' || (cmd === 'mode' && arg1 === 'sniffer')) {
      setTuiMode('cansniffer');
      setCmdFeedback('Switched to cansniffer table mode');
    } else if (cmd === 'dump' || (cmd === 'mode' && arg1 === 'dump')) {
      setTuiMode('candump');
      setCmdFeedback('Switched to candump streaming mode');
    } else if (cmd === 'pause') {
      if (isRunning) onTogglePause();
      setCmdFeedback('Ingress paused');
    } else if (cmd === 'resume' || cmd === 'run') {
      if (!isRunning) onTogglePause();
      setCmdFeedback('Ingress resumed');
    } else if (cmd === 'step') {
      onStepForward();
      setCmdFeedback('Stepped 1 packet forward');
    } else if (cmd === 'clear') {
      onClearHistory();
      setCmdFeedback('Message buffer cleared');
    } else if (cmd === 'search') {
      const term = parts.slice(1).join(' ');
      setTuiSearch(term);
      setCmdFeedback(`Filter applied: "${term}"`);
    } else if (cmd === 'theme') {
      if (['green', 'amber', 'cyan', 'matrix'].includes(arg1)) {
        setTheme(arg1 as TuiTheme);
        setCmdFeedback(`Theme set to ${arg1}`);
      } else {
        setCmdFeedback('Themes: green, amber, cyan, matrix');
      }
    } else if (cmd === 'preset') {
      if (arg1 === 'flood' || arg1 === 'dos') {
        onPresetChange('dos_flood');
        setCmdFeedback('Preset: DoS Flood');
      } else if (arg1 === 'fuzz' || arg1 === 'fuzzing') {
        onPresetChange('fuzzing');
        setCmdFeedback('Preset: CAN Fuzzing');
      } else if (arg1 === 'replay') {
        onPresetChange('replay_attack');
        setCmdFeedback('Preset: Replay Attack Sequence');
      } else if (arg1 === 'normal') {
        onPresetChange('normal');
        setCmdFeedback('Preset: Nominal Telemetry');
      } else {
        setCmdFeedback('Presets: normal, flood, fuzz, replay');
      }
    } else if (cmd === 'export') {
      if (onExportCsv) onExportCsv();
      setCmdFeedback('Forensic CSV download triggered');
    } else {
      setCmdFeedback(`Unknown command: "${cmd}". Type "help" for list.`);
    }

    setCmdInput('');
    setTimeout(() => setCmdFeedback(''), 4500);
  };

  // Color theme definitions
  const themeStyles = {
    green: {
      text: 'text-emerald-400',
      textDim: 'text-emerald-700',
      border: 'border-emerald-600/40',
      bgGlow: 'bg-emerald-950/20',
      headerBg: 'bg-emerald-950/40',
      highlight: 'bg-emerald-500 text-slate-950 font-bold',
      prompt: 'text-emerald-300',
      badge: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
    },
    amber: {
      text: 'text-amber-400',
      textDim: 'text-amber-700',
      border: 'border-amber-600/40',
      bgGlow: 'bg-amber-950/20',
      headerBg: 'bg-amber-950/40',
      highlight: 'bg-amber-500 text-slate-950 font-bold',
      prompt: 'text-amber-300',
      badge: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
    },
    cyan: {
      text: 'text-cyan-400',
      textDim: 'text-cyan-700',
      border: 'border-cyan-600/40',
      bgGlow: 'bg-cyan-950/20',
      headerBg: 'bg-cyan-950/40',
      highlight: 'bg-cyan-500 text-slate-950 font-bold',
      prompt: 'text-cyan-300',
      badge: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300',
    },
    matrix: {
      text: 'text-green-400',
      textDim: 'text-green-800',
      border: 'border-green-600/40',
      bgGlow: 'bg-green-950/30',
      headerBg: 'bg-green-950/50',
      highlight: 'bg-green-400 text-slate-950 font-bold',
      prompt: 'text-green-300',
      badge: 'border-green-500/50 bg-green-500/10 text-green-300',
    },
  }[theme];

  const violationsCount = snifferRows.filter((r) => r.isOverThreshold).length;

  return (
    <div className={`rounded-xl border ${themeStyles.border} bg-slate-950 font-mono text-xs overflow-hidden shadow-2xl relative select-none`}>
      {/* Retro CRT Scanline Overlay Texture */}
      <div
        className="pointer-events-none absolute inset-0 z-20 opacity-[0.04] bg-repeat"
        style={{
          backgroundImage:
            'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.4) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
          backgroundSize: '100% 3px, 3px 100%',
        }}
      />

      {/* TUI Terminal Header Banner */}
      <div className={`px-4 py-3 border-b ${themeStyles.border} ${themeStyles.headerBg} flex flex-wrap items-center justify-between gap-3 text-xs`}>
        <div className="flex items-center gap-2">
          <TerminalIcon className={`w-4 h-4 ${themeStyles.text}`} />
          <span className={`font-bold ${themeStyles.text} tracking-wider`}>
            CAN-SENTINEL TUI v1.4.2 [vcan0]
          </span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400 text-[11px]">
            AUTOMOTIVE BUS MONITOR & DIFF SNIFFER
          </span>
        </div>

        {/* Status Indicators in Header */}
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-slate-400">
            UPTIME: <span className="text-white font-bold">{formatUptime(uptimeSeconds)}</span>
          </span>
          <span className="text-slate-400">
            RATE: <span className={`${themeStyles.text} font-bold`}>{currentFps} fps</span>
          </span>
          <span className="text-slate-400">
            BUFFER: <span className="text-white font-bold">{packets.length}/100</span>
          </span>
          <span
            className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
              isSocketCanActive
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            }`}
          >
            {isSocketCanActive ? 'VCAN0: UP' : 'VCAN0: DOWN'}
          </span>
          {violationsCount > 0 && (
            <span className="px-2 py-0.5 rounded border border-rose-500/50 bg-rose-500/20 text-rose-300 font-bold animate-pulse">
              ⚠️ {violationsCount} THRESHOLD VIOLATION{violationsCount > 1 ? 'S' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Terminal Control Toolbar */}
      <div className={`px-4 py-2 border-b ${themeStyles.border} bg-slate-900/80 flex flex-wrap items-center justify-between gap-2 text-xs`}>
        {/* Mode Switch: cansniffer vs candump */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-[11px] mr-1">MODE:</span>
          <button
            onClick={() => setTuiMode('cansniffer')}
            className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors cursor-pointer ${
              tuiMode === 'cansniffer'
                ? themeStyles.highlight
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            [1] cansniffer (Table & Diff)
          </button>
          <button
            onClick={() => setTuiMode('candump')}
            className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors cursor-pointer ${
              tuiMode === 'candump'
                ? themeStyles.highlight
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            [2] candump (Rolling Stream)
          </button>
        </div>

        {/* Controls: Play/Pause, Step, Clear, Theme */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={onTogglePause}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs border font-medium cursor-pointer ${
              isRunning
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
            }`}
          >
            {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{isRunning ? 'Freeze [P]' : 'Resume [P]'}</span>
          </button>

          <button
            onClick={onStepForward}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
            title="Step 1 packet forward"
          >
            <StepForward className="w-3 h-3" />
            <span>Step [S]</span>
          </button>

          <button
            onClick={onClearHistory}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
            title="Clear buffer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear [C]</span>
          </button>

          {onExportCsv && (
            <button
              onClick={onExportCsv}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-600/40 cursor-pointer"
              title="Export forensic CSV"
            >
              <Download className="w-3 h-3" />
              <span>CSV [E]</span>
            </button>
          )}

          {/* Theme Selector */}
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-800">
            <span className="text-[10px] text-slate-500">THEME:</span>
            {(['green', 'amber', 'cyan', 'matrix'] as TuiTheme[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`w-4 h-4 rounded-full border ${
                  theme === t ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'
                } ${
                  t === 'green'
                    ? 'bg-emerald-500 border-emerald-400'
                    : t === 'amber'
                    ? 'bg-amber-500 border-amber-400'
                    : t === 'cyan'
                    ? 'bg-cyan-500 border-cyan-400'
                    : 'bg-green-500 border-green-400'
                }`}
                title={`Switch to ${t} phosphor theme`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* TUI Search / Filter Bar */}
      <div className={`px-4 py-2 border-b ${themeStyles.border} bg-slate-950 flex items-center justify-between gap-3 text-xs`}>
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className={`w-3.5 h-3.5 ${themeStyles.text}`} />
          <input
            type="text"
            value={tuiSearch}
            onChange={(e) => setTuiSearch(e.target.value)}
            placeholder="TUI Filter: payload byte (e.g. 00 00, 11 22), CAN ID (0x280), or timestamp..."
            className={`w-full bg-transparent border-none text-xs font-mono text-white placeholder-slate-600 focus:outline-none`}
          />
          {tuiSearch && (
            <button
              onClick={() => setTuiSearch('')}
              className="text-slate-500 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          {tuiSearch && (
            <span className={themeStyles.text}>
              FILTER ACTIVE: &quot;{tuiSearch}&quot;
            </span>
          )}
          <span>
            {tuiMode === 'cansniffer'
              ? `${snifferRows.length} active IDs displayed`
              : `${candumpLines.length} frames in stream`}
          </span>
        </div>
      </div>

      {/* Main Terminal Body Area */}
      <div className="p-4 bg-slate-950 overflow-x-auto min-h-[360px] max-h-[460px] overflow-y-auto">
        {/* MODE 1: CAN-SNIFFER (Table with byte-diff highlighting) */}
        {tuiMode === 'cansniffer' && (
          <div className="space-y-1">
            <div className={`text-[11px] border-b ${themeStyles.border} pb-1 mb-2 text-slate-500 flex justify-between font-bold`}>
              <span>CAN ID   IFACE  DELTA(µs)  FREQ/LIMIT    DLC   DATA PAYLOAD [B0..B7] (DIFF HIGHLIGHTED)       SIGNAL / TELEMETRY</span>
              <span>[cansniffer v1.4]</span>
            </div>

            {snifferRows.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                Awaiting CAN traffic on vcan0... (Resume simulator or generate packets)
              </div>
            ) : (
              snifferRows.map((row) => {
                return (
                  <div
                    key={row.canId}
                    className={`p-1.5 rounded flex items-center justify-between text-xs transition-colors ${
                      row.isOverThreshold
                        ? 'bg-rose-950/30 border border-rose-500/50'
                        : row.isAnomaly
                        ? 'bg-amber-950/20 border border-amber-500/30'
                        : 'hover:bg-slate-900 border border-transparent'
                    }`}
                  >
                    {/* Left Column: ID & Meta */}
                    <div className="flex items-center gap-3">
                      <span className={`font-bold w-16 ${row.isAnomaly ? 'text-rose-400' : 'text-white'}`}>
                        {row.hexId}
                      </span>
                      <span className="text-slate-500 w-12">vcan0</span>
                      <span className="text-cyan-400 w-16 text-right">
                        +{row.deltaUs}µs
                      </span>

                      {/* Frequency & Threshold Limit */}
                      <span
                        className={`w-24 text-right px-1.5 py-0.5 rounded text-[11px] font-bold ${
                          row.isOverThreshold
                            ? 'bg-rose-500 text-slate-950 animate-pulse'
                            : 'text-slate-400'
                        }`}
                        title={`Current rate: ${row.hz} Hz | Max threshold: ${row.thresholdLimit} Hz`}
                      >
                        {row.hz}Hz/{row.thresholdLimit}Hz
                      </span>

                      <span className="text-amber-400 font-bold w-6 text-center">
                        [{row.dlc}]
                      </span>

                      {/* 8-Byte Data Payload with cansniffer-style byte diff highlighting */}
                      <div className="flex items-center gap-1.5 font-bold tracking-wider">
                        {Array.from({ length: row.dlc }).map((_, idx) => {
                          const byteVal = row.data[idx] ?? 0;
                          const changed = row.byteChangedFlags[idx];
                          const hexByte = byteVal.toString(16).padStart(2, '0').toUpperCase();

                          return (
                            <span
                              key={idx}
                              className={`px-1 py-0.5 rounded transition-all duration-300 ${
                                changed
                                  ? row.isAnomaly
                                    ? 'bg-rose-500 text-white font-extrabold animate-pulse'
                                    : 'bg-emerald-400 text-slate-950 font-extrabold'
                                  : 'text-slate-300'
                              }`}
                            >
                              {hexByte}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right Column: Signal Name & Anomaly / Threshold Status */}
                    <div className="flex items-center gap-2 max-w-[280px] truncate text-right">
                      {row.isOverThreshold && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold shrink-0">
                          OVER LIMIT
                        </span>
                      )}
                      {row.isAnomaly && !row.isOverThreshold && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shrink-0">
                          ANOMALY
                        </span>
                      )}
                      <span className={`text-[11px] truncate ${row.isAnomaly ? 'text-rose-300' : 'text-slate-400'}`}>
                        {row.name}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* MODE 2: CANDUMP (Rolling real-time terminal stream) */}
        {tuiMode === 'candump' && (
          <div className="space-y-1 font-mono text-xs">
            <div className={`text-[11px] border-b ${themeStyles.border} pb-1 mb-2 text-slate-500 flex justify-between font-bold`}>
              <span>(TIMESTAMP_US)  IFACE   CAN_ID   [DLC]  DATA_PAYLOAD_HEX          ASCII       ANNOTATION</span>
              <span>[candump stream]</span>
            </div>

            {candumpLines.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                No frames in stream matching query &quot;{tuiSearch}&quot;
              </div>
            ) : (
              candumpLines.map((pkt) => {
                const hexId = pkt.canId.toString(16).toUpperCase().padStart(3, '0');
                const hexPayload = pkt.data
                  .slice(0, pkt.dlc)
                  .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
                  .join(' ');
                const ascii = pkt.data
                  .slice(0, pkt.dlc)
                  .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
                  .join('');

                const isAlert = pkt.isAnomaly || pkt.isPotentialAnomaly;

                return (
                  <div
                    key={pkt.id}
                    className={`py-0.5 px-1 rounded flex items-center justify-between text-xs hover:bg-slate-900 ${
                      isAlert ? 'bg-rose-950/20 text-rose-300' : 'text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 w-28">
                        ({pkt.timestampUs.toString().padStart(10, '0')})
                      </span>
                      <span className="text-slate-400 w-12">vcan0</span>
                      <span className={`font-bold w-12 ${isAlert ? 'text-rose-400' : themeStyles.text}`}>
                        {hexId}
                      </span>
                      <span className="text-amber-400 w-6">[{pkt.dlc}]</span>
                      <span className="font-bold text-white tracking-wider w-56">
                        {hexPayload}
                      </span>
                      <span className="text-slate-500 text-[11px] w-20">
                        &apos;{ascii}&apos;
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      {pkt.isPotentialAnomaly && (
                        <span className="text-amber-400 font-bold">[POTENTIAL_ANOMALY]</span>
                      )}
                      {pkt.isAnomaly && !pkt.isPotentialAnomaly && (
                        <span className="text-rose-400 font-bold">[INTRUSION]</span>
                      )}
                      <span className="text-slate-400 truncate max-w-[180px]">
                        #{pkt.signalName || ''}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Interactive Command Prompt Line */}
      <div className={`px-4 py-2 border-t ${themeStyles.border} bg-slate-900/90 flex items-center justify-between gap-3 text-xs`}>
        <form onSubmit={handleCommandSubmit} className="flex-1 flex items-center gap-2">
          <span className={`${themeStyles.prompt} font-bold`}>can-sentinel:~$</span>
          <input
            type="text"
            value={cmdInput}
            onChange={(e) => setCmdInput(e.target.value)}
            placeholder="Type TUI command: help, sniffer, dump, pause, resume, step, clear, search <term>, preset <flood|normal|replay>..."
            className="flex-1 bg-transparent border-none text-xs font-mono text-white placeholder-slate-600 focus:outline-none"
          />
        </form>

        {cmdFeedback && (
          <span className={`text-[11px] font-bold ${themeStyles.text} px-2 py-0.5 rounded bg-slate-950 border border-slate-800`}>
            {cmdFeedback}
          </span>
        )}

        <div className="text-[10px] text-slate-500 font-mono hidden md:block">
          Press Enter to execute
        </div>
      </div>
    </div>
  );
};
