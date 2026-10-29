import React, { useState, useEffect, useRef } from 'react';
import { DecodedCanFrame, TrafficPreset } from '../types/can';
import {
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  Flame,
  Car,
  Radio,
  Zap,
  Activity,
  ServerOff,
  Server
} from 'lucide-react';

export const SimulatorView: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [preset, setPreset] = useState<TrafficPreset>('normal');
  const [trafficRateHz, setTrafficRateHz] = useState<number>(50); // Hz
  const [pythonServerOnline, setPythonServerOnline] = useState<boolean>(true);

  // Stats
  const [framesReceived, setFramesReceived] = useState<number>(0);
  const [framesForwarded, setFramesForwarded] = useState<number>(0);
  const [framesDropped, setFramesDropped] = useState<number>(0);
  const [reconnectRetries, setReconnectRetries] = useState<number>(0);
  const [frameHistory, setFrameHistory] = useState<DecodedCanFrame[]>([]);
  const [currentFps, setCurrentFps] = useState<number>(0);

  const lastTsRef = useRef<number>(Date.now() * 1000);
  const frameIdCounter = useRef<number>(0);
  const windowCount = useRef<number>(0);

  // FPS ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFps(windowCount.current);
      windowCount.current = 0;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Frame generator loop
  useEffect(() => {
    if (!isRunning) return;

    const delayMs = Math.max(10, Math.floor(1000 / trafficRateHz));
    const timer = setInterval(() => {
      frameIdCounter.current += 1;
      windowCount.current += 1;
      const nowUs = Date.now() * 1000 + (frameIdCounter.current % 1000);
      const deltaUs = Math.max(1, nowUs - lastTsRef.current);
      lastTsRef.current = nowUs;

      let newFrame: DecodedCanFrame;

      if (preset === 'normal') {
        const types = [
          { id: 0x280, name: 'Engine RPM', dlc: 8, gen: () => [0x11, Math.floor(Math.random() * 255), 0x33, 0x44, 0x00, 0x00, 0x00, 0x00], decode: (d: number[]) => `${((d[0] * 256 + d[1]) * 0.25).toFixed(0)} RPM` },
          { id: 0x284, name: 'Vehicle Speed', dlc: 8, gen: () => [0x00, Math.floor(60 + Math.random() * 20), 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], decode: (d: number[]) => `${d[1]} km/h` },
          { id: 0x190, name: 'Brake Pressure', dlc: 4, gen: () => [0x22, Math.floor(Math.random() * 50), 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], decode: (d: number[]) => `${d[1]} bar` },
          { id: 0x025, name: 'Steering Angle', dlc: 4, gen: () => [0x05, Math.floor(Math.random() * 20), 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], decode: (d: number[]) => `${d[1]} deg` }
        ];
        const pick = types[Math.floor(Math.random() * types.length)];
        const data = pick.gen();
        newFrame = {
          id: frameIdCounter.current,
          timestampUs: nowUs,
          deltaUs,
          canId: pick.id,
          rawCanId: pick.id,
          isExtended: false,
          isRtr: false,
          isError: false,
          dlc: pick.dlc,
          data,
          signalName: pick.name,
          decodedValue: pick.decode(data),
          isAnomaly: false
        };
      } else if (preset === 'dos_flood') {
        // High priority ID 0x000 storm
        newFrame = {
          id: frameIdCounter.current,
          timestampUs: nowUs,
          deltaUs: Math.floor(Math.random() * 30 + 10),
          canId: 0x000,
          rawCanId: 0x000,
          isExtended: false,
          isRtr: false,
          isError: false,
          dlc: 8,
          data: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
          signalName: 'BUS FLOOD ATTACK (ID 0x000)',
          decodedValue: 'PRIORITY ARBITRATION OVERRIDE',
          isAnomaly: true
        };
      } else if (preset === 'fuzzing') {
        const randId = Math.floor(Math.random() * 0x7FF);
        const randPayload = Array.from({ length: 8 }, () => Math.floor(Math.random() * 256));
        newFrame = {
          id: frameIdCounter.current,
          timestampUs: nowUs,
          deltaUs,
          canId: randId,
          rawCanId: randId,
          isExtended: false,
          isRtr: false,
          isError: false,
          dlc: 8,
          data: randPayload,
          signalName: 'CAN FUZZING INJECTION',
          decodedValue: 'RANDOM PAYLOAD',
          isAnomaly: true
        };
      } else {
        // Spoofed ABS / Critical
        newFrame = {
          id: frameIdCounter.current,
          timestampUs: nowUs,
          deltaUs,
          canId: 0x18DAF110,
          rawCanId: 0x18DAF110 | 0x80000000,
          isExtended: true,
          isRtr: false,
          isError: false,
          dlc: 8,
          data: [0xFF, 0x00, 0xAA, 0x55, 0x12, 0x34, 0x56, 0x78],
          signalName: 'SPOOFED BRAKE/ABS ACTUATION',
          decodedValue: 'CRITICAL EFF CAN ATTACK',
          isAnomaly: true
        };
      }

      setFramesReceived((prev) => prev + 1);

      if (pythonServerOnline) {
        setFramesForwarded((prev) => prev + 1);
      } else {
        setFramesDropped((prev) => prev + 1);
        if (frameIdCounter.current % 15 === 0) {
          setReconnectRetries((prev) => prev + 1);
        }
      }

      setFrameHistory((prev) => [newFrame, ...prev.slice(0, 49)]);
    }, delayMs);

    return () => clearInterval(timer);
  }, [isRunning, preset, trafficRateHz, pythonServerOnline]);

  const handleReset = () => {
    setFramesReceived(0);
    setFramesForwarded(0);
    setFramesDropped(0);
    setReconnectRetries(0);
    setFrameHistory([]);
    windowCount.current = 0;
    setCurrentFps(0);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Title */}
      <div className="border-b border-slate-800 pb-6">
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wide mb-2">
          <span>INTERACTIVE INGRESS WORKBENCH</span>
          <span>·</span>
          <span>SOCKETCAN & UDS SIMULATOR</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Real-Time CAN Bus & Unix Domain Socket Stream
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-3xl leading-relaxed">
          Simulate virtual CAN traffic injection, stress-test high throughput rates,
          and observe the C forwarder's zero-allocation serialization and automatic UDS reconnection state machine.
        </p>
      </div>

      {/* Control Strip & Attack Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Play/Pause & Reset */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                isRunning
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                  : 'bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400'
              }`}
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isRunning ? 'Pause Ingress' : 'Resume Ingress'}</span>
            </button>

            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Counters</span>
            </button>
          </div>

          {/* Python Server Offline/Online Toggle (Fault Injection) */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Downstream Python UDS Receiver:</span>
            <button
              onClick={() => setPythonServerOnline(!pythonServerOnline)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                pythonServerOnline
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30'
              }`}
            >
              {pythonServerOnline ? <Server className="w-3.5 h-3.5" /> : <ServerOff className="w-3.5 h-3.5" />}
              <span>{pythonServerOnline ? 'Server Online (/tmp/can_sentinel.sock)' : 'Server Offline (Simulate Crash)'}</span>
            </button>
          </div>
        </div>

        {/* Traffic Scenarios & Frequency Slider */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Automotive Traffic Scenario Preset:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => setPreset('normal')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs transition-colors ${
                  preset === 'normal'
                    ? 'bg-slate-800 border-emerald-500/50 text-emerald-300 font-semibold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                }`}
              >
                <Car className="w-3.5 h-3.5 mb-1" />
                <span>Normal Telemetry</span>
              </button>
              <button
                onClick={() => setPreset('dos_flood')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs transition-colors ${
                  preset === 'dos_flood'
                    ? 'bg-slate-800 border-red-500/50 text-red-300 font-semibold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                }`}
              >
                <Flame className="w-3.5 h-3.5 mb-1" />
                <span>DoS Bus Flood</span>
              </button>
              <button
                onClick={() => setPreset('fuzzing')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs transition-colors ${
                  preset === 'fuzzing'
                    ? 'bg-slate-800 border-amber-500/50 text-amber-300 font-semibold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                }`}
              >
                <Radio className="w-3.5 h-3.5 mb-1" />
                <span>CAN Fuzzing</span>
              </button>
              <button
                onClick={() => setPreset('spoofed_abs')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs transition-colors ${
                  preset === 'spoofed_abs'
                    ? 'bg-slate-800 border-purple-500/50 text-purple-300 font-semibold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 mb-1" />
                <span>Spoofed ABS</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-medium text-slate-400">
                Frame Ingress Frequency: <span className="text-white font-mono font-bold">{trafficRateHz} Hz</span>
              </label>
              <span className="text-xs text-slate-500 font-mono">10 Hz to 200 Hz</span>
            </div>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              value={trafficRateHz}
              onChange={(e) => setTrafficRateHz(parseInt(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer mt-2"
            />
          </div>
        </div>
      </div>

      {/* Real-Time Telemetry Counters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-xs text-slate-400 block mb-1">Frames Ingested</span>
          <span className="text-xl font-bold font-mono tabular-nums text-white">
            {framesReceived.toLocaleString()}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-xs text-slate-400 block mb-1">Forwarded (UDS)</span>
          <span className="text-xl font-bold font-mono tabular-nums text-emerald-400">
            {framesForwarded.toLocaleString()}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-xs text-slate-400 block mb-1">Dropped (UDS Offline)</span>
          <span className={`text-xl font-bold font-mono tabular-nums ${framesDropped > 0 ? 'text-red-400' : 'text-slate-500'}`}>
            {framesDropped.toLocaleString()}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <span className="text-xs text-slate-400 block mb-1">Reconnect Retries</span>
          <span className="text-xl font-bold font-mono tabular-nums text-amber-400">
            {reconnectRetries}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 col-span-2 md:col-span-1">
          <span className="text-xs text-slate-400 block mb-1">Instant Throughput</span>
          <span className="text-xl font-bold font-mono tabular-nums text-cyan-400">
            {currentFps} <span className="text-xs font-normal text-slate-400">fps</span>
          </span>
        </div>
      </div>

      {/* Stream Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-850 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
              Live Ingest Stream ({frameHistory.length} buffered)
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Transport: {pythonServerOnline ? 'AF_UNIX (STREAMING)' : 'OFFLINE (RECONNECTING...)'}
          </span>
        </div>

        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Timestamp (µs)</th>
                <th className="py-2.5 px-3">Δt (µs)</th>
                <th className="py-2.5 px-3">CAN ID</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">DLC</th>
                <th className="py-2.5 px-3">Payload (8 Bytes Hex)</th>
                <th className="py-2.5 px-3">Signal / Interpretation</th>
                <th className="py-2.5 px-3">UDS Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {frameHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                    Ingress stream idle. Click &quot;Resume Ingress&quot; to begin capturing frames.
                  </td>
                </tr>
              ) : (
                frameHistory.map((frame) => (
                  <tr
                    key={frame.id}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      frame.isAnomaly ? 'bg-red-950/20 text-red-200' : 'text-slate-300'
                    }`}
                  >
                    <td className="py-2 px-3 text-slate-500 tabular-nums">{frame.id}</td>
                    <td className="py-2 px-3 tabular-nums text-slate-400">{frame.timestampUs}</td>
                    <td className="py-2 px-3 tabular-nums text-cyan-400">+{frame.deltaUs}</td>
                    <td className="py-2 px-3 font-bold text-white">
                      0x{frame.canId.toString(16).toUpperCase().padStart(3, '0')}
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-[10px] text-slate-400">
                        {frame.isExtended ? 'EFF (29b)' : 'SFF (11b)'}
                      </span>
                    </td>
                    <td className="py-2 px-3 tabular-nums text-amber-400">{frame.dlc}</td>
                    <td className="py-2 px-3 text-purple-300 font-bold">
                      {frame.data.slice(0, frame.dlc).map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}
                    </td>
                    <td className="py-2 px-3 text-xs font-sans">
                      <span className={frame.isAnomaly ? 'text-red-400 font-semibold' : 'text-slate-300'}>
                        {frame.signalName} ({frame.decodedValue})
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {pythonServerOnline ? (
                        <span className="text-emerald-400 text-[11px] font-sans">Streamed</span>
                      ) : (
                        <span className="text-red-400 text-[11px] font-sans">Dropped (UDS Offline)</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
