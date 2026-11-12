import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DecodedCanFrame, TrafficPreset } from '../types/can';
import { MessageLog } from './MessageLog';
import { CanTuiView } from './CanTuiView';
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Repeat,
  AlertTriangle,
  Flame,
  Car,
  Radio,
  ServerOff,
  Server,
  Filter,
  BarChart3,
  TrendingUp,
  X,
  Plus,
  Eye,
  EyeOff,
  Download,
  Check,
  Clock,
  Sliders,
  Terminal,
  SlidersHorizontal,
  Trash2,
  ShieldAlert,
  Settings
} from 'lucide-react';

interface SimulatorViewProps {
  isSocketCanActive?: boolean;
  onToggleSocketCan?: (active?: boolean) => void;
  initialViewMode?: 'gui' | 'tui';
}

interface CanIdStat {
  id: number;
  hexId: string;
  name: string;
  isAnomaly: boolean;
  isExtended: boolean;
  totalCount: number;
  hz: number;
  percentage: number;
  thresholdLimit: number;
  isOverThreshold: boolean;
}

interface TimelinePointData {
  secondOffset: number;
  secondsAgo: number;
  totalCount: number;
  idBreakdown: Array<{
    id: number;
    hexId: string;
    name: string;
    count: number;
    hz: number;
    percentage: number;
    isAnomaly: boolean;
  }>;
}

// Predefined Sequence of Malicious Packets for Replay Attack Mode
const REPLAY_ATTACK_SEQUENCE = [
  {
    canId: 0x1b0,
    dlc: 8,
    data: [0x02, 0x10, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00],
    signalName: 'REPLAY: DIAGNOSTIC SESSION (STEP 1/6)',
    decodedValue: 'ExtDiag (0x10 0x03) Gateway Bypass',
    isAnomaly: true,
    isExtended: false,
  },
  {
    canId: 0x1a6,
    dlc: 8,
    data: [0x55, 0xaa, 0x01, 0xff, 0x00, 0x00, 0x00, 0x00],
    signalName: 'REPLAY: DOOR UNLOCK ACTUATION (STEP 2/6)',
    decodedValue: 'ALL_DOORS_UNLOCKED (Stolen Trace)',
    isAnomaly: true,
    isExtended: false,
  },
  {
    canId: 0x280,
    dlc: 8,
    data: [0x11, 0xf4, 0x33, 0x44, 0x00, 0x00, 0x00, 0x00],
    signalName: 'REPLAY: ENGINE ACCEL INJECTION (STEP 3/6)',
    decodedValue: '6,100 RPM (Full Throttle Command)',
    isAnomaly: true,
    isExtended: false,
  },
  {
    canId: 0x284,
    dlc: 8,
    data: [0x00, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    signalName: 'REPLAY: SPEEDOMETER OVERRIDE (STEP 4/6)',
    decodedValue: '180 km/h (Injected Wheel Ticks)',
    isAnomaly: true,
    isExtended: false,
  },
  {
    canId: 0x190,
    dlc: 4,
    data: [0x22, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    signalName: 'REPLAY: STEERING TORQUE BIAS (STEP 5/6)',
    decodedValue: '+34.5 Nm Torque Injection',
    isAnomaly: true,
    isExtended: false,
  },
  {
    canId: 0x025,
    dlc: 8,
    data: [0x5f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    signalName: 'REPLAY: THERMAL OVERTEMP FAULT (STEP 6/6)',
    decodedValue: '95°C Thermal Warning False Alarm',
    isAnomaly: true,
    isExtended: false,
  },
];

// Baseline whitelisted OEM CAN IDs
const WHITELISTED_CAN_IDS = new Set([0x280, 0x284, 0x190, 0x025]);

// Known blacklisted / malicious CAN IDs
const BLACKLISTED_CAN_IDS = new Set([0x000, 0x18daf110, 0x1b0, 0x1a6]);

// Default OEM Frequency Thresholds (Hz)
const DEFAULT_THRESHOLD_RULES: Record<number, number> = {
  0x280: 25, // Engine RPM (nominal ~20 Hz)
  0x284: 20, // Wheel Speed (nominal ~15 Hz)
  0x190: 25, // Steering Angle (nominal ~20 Hz)
  0x025: 10, // Battery Temperature (nominal ~5 Hz)
  0x000: 5,  // DoS Flood / Priority (expected 0 Hz, max 5 Hz limit)
  0x18daf110: 5, // Spoofed Brake (expected 0 Hz, max 5 Hz limit)
};

export const SimulatorView: React.FC<SimulatorViewProps> = ({
  isSocketCanActive = true,
  onToggleSocketCan,
  initialViewMode = 'gui',
}) => {
  // View mode: Graphical Workbench vs Retro Terminal UI (TUI) Sniffer
  const [viewMode, setViewMode] = useState<'gui' | 'tui'>(initialViewMode);

  // Sync internal running state with parent SocketCAN connection state if provided
  const [localRunning, setLocalRunning] = useState<boolean>(true);
  const isRunning = isSocketCanActive !== undefined ? isSocketCanActive : localRunning;

  const [preset, setPreset] = useState<TrafficPreset>('normal');
  const [pythonServerOnline, setPythonServerOnline] = useState<boolean>(true);

  // Frequency Threshold Settings State
  const [showThresholdSettings, setShowThresholdSettings] = useState<boolean>(false);
  const [globalThresholdHz, setGlobalThresholdHz] = useState<number>(45);
  const [thresholdRules, setThresholdRules] = useState<Record<number, number>>(DEFAULT_THRESHOLD_RULES);
  const [newRuleIdInput, setNewRuleIdInput] = useState<string>('');
  const [newRuleHzInput, setNewRuleHzInput] = useState<string>('30');
  const [activeViolations, setActiveViolations] = useState<
    Array<{ id: number; hexId: string; name: string; hz: number; thresholdLimit: number }>
  >([]);

  // Simulation Metrics
  const [framesReceived, setFramesReceived] = useState<number>(0);
  const [framesForwarded, setFramesForwarded] = useState<number>(0);
  const [framesDropped, setFramesDropped] = useState<number>(0);
  const [reconnectRetries, setReconnectRetries] = useState<number>(0);
  const [currentFps, setCurrentFps] = useState<number>(0);
  const [exportedCsv, setExportedCsv] = useState<boolean>(false);

  // 20-second rolling history of instant throughput (frames per second)
  const [sparklineHistory, setSparklineHistory] = useState<number[]>(
    Array(20).fill(0)
  );

  // 20-second rolling history of exact point data snapshots for hover tooltips
  const [timelineSnapshots, setTimelineSnapshots] = useState<TimelinePointData[]>(
    Array.from({ length: 20 }, (_, i) => ({
      secondOffset: i,
      secondsAgo: 19 - i,
      totalCount: 0,
      idBreakdown: [],
    }))
  );
  const [hoveredTimelineIndex, setHoveredTimelineIndex] = useState<number | null>(null);

  // Real-time CAN ID Frequency distribution
  const [idFrequencyStats, setIdFrequencyStats] = useState<CanIdStat[]>([]);

  // CAN Packet ID Filter State
  const [idFilterInput, setIdFilterInput] = useState<string>('');
  const [idFilterMode, setIdFilterMode] = useState<'show' | 'hide'>('show');

  // Captured Message Log History (Ring buffer)
  const [packetHistory, setPacketHistory] = useState<DecodedCanFrame[]>([]);

  const lastTsRef = useRef<number>(Date.now() * 1000);
  const frameIdCounter = useRef<number>(0);
  const windowCount = useRef<number>(0);
  const replayIndexRef = useRef<number>(-1);

  // Ref tracking per-ID arrival counts in the current 1-second window and lifetime
  const idIntervalArrivalsRef = useRef<Map<number, number>>(new Map());
  const idLifetimeTotalsRef = useRef<Map<number, number>>(new Map());
  const idMetadataRef = useRef<
    Map<
      number,
      {
        name: string;
        isAnomaly: boolean;
        isExtended: boolean;
      }
    >
  >(new Map());

  // Playback Control Handlers
  const handlePause = () => {
    if (onToggleSocketCan) {
      onToggleSocketCan(false);
    } else {
      setLocalRunning(false);
    }
  };

  const handleResume = () => {
    if (onToggleSocketCan) {
      onToggleSocketCan(true);
    } else {
      setLocalRunning(true);
    }
  };

  const handleStepForward = () => {
    if (isRunning) {
      if (onToggleSocketCan) {
        onToggleSocketCan(false);
      } else {
        setLocalRunning(false);
      }
    }
    generateAndDispatchFrame();
  };

  // Threshold Management Handlers
  const handleAddOrUpdateThresholdRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleIdInput.trim()) return;

    let targetId: number | null = null;
    const clean = newRuleIdInput.trim().toLowerCase();
    if (clean.startsWith('0x')) {
      targetId = parseInt(clean, 16);
    } else if (/^[0-9a-f]+$/i.test(clean) && (clean.length === 3 || clean.length === 8)) {
      targetId = parseInt(clean, 16);
    } else {
      targetId = parseInt(clean, 10);
    }

    const hz = parseInt(newRuleHzInput, 10);
    if (targetId !== null && !isNaN(targetId) && !isNaN(hz) && hz > 0) {
      setThresholdRules((prev) => ({
        ...prev,
        [targetId]: hz,
      }));
      setNewRuleIdInput('');
    }
  };

  const handleRemoveThresholdRule = (idToRemove: number) => {
    setThresholdRules((prev) => {
      const next = { ...prev };
      delete next[idToRemove];
      return next;
    });
  };

  const handleResetThresholdRules = () => {
    setThresholdRules(DEFAULT_THRESHOLD_RULES);
    setGlobalThresholdHz(45);
  };

  // Forensic CSV Export Handler
  const handleExportForensicCsv = () => {
    if (packetHistory.length === 0) return;

    const headers = [
      'Packet_ID',
      'Timestamp_Epoch_Microseconds',
      'Delta_Microseconds',
      'CAN_ID_Hex',
      'CAN_ID_Decimal',
      'Frame_Format',
      'Payload_Length_DLC',
      'Payload_Hex_Bytes',
      'Payload_Decimal_Bytes',
      'Signal_Classification',
      'Decoded_Engineering_Value',
      'Is_Anomaly',
      'Potential_Anomaly_Status',
      'Anomaly_Detection_Reason',
      'UDS_Dispatch_State'
    ];

    const rows = packetHistory.map((p) => {
      const hexPayload = p.data
        .slice(0, p.dlc)
        .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
      const decBytes = p.data.slice(0, p.dlc).join(' ');
      const hexId = `0x${p.canId.toString(16).toUpperCase().padStart(3, '0')}`;

      return [
        p.id,
        p.timestampUs,
        p.deltaUs,
        `"${hexId}"`,
        p.canId,
        p.isExtended ? 'EFF_29_BIT' : 'SFF_11_BIT',
        p.dlc,
        `"${hexPayload}"`,
        `"${decBytes}"`,
        `"${p.signalName ? p.signalName.replace(/"/g, '""') : ''}"`,
        `"${p.decodedValue ? p.decodedValue.replace(/"/g, '""') : ''}"`,
        p.isAnomaly ? 'TRUE' : 'FALSE',
        p.isPotentialAnomaly ? 'POTENTIAL_ANOMALY' : 'NORMAL',
        `"${
          p.anomalyReason
            ? p.anomalyReason.replace(/"/g, '""')
            : p.isAnomaly
            ? 'Malicious Exploit Frame'
            : 'Nominal OEM Telemetry'
        }"`,
        pythonServerOnline ? 'FORWARDED_UDS' : 'DROPPED_UDS_OFFLINE'
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.setAttribute('download', `can_sentinel_forensic_log_${timestampStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportedCsv(true);
    setTimeout(() => setExportedCsv(false), 2500);
  };

  // Parse user input string for CAN IDs (supports "0x280", "280", comma or space separated)
  const parsedFilterIds = useMemo(() => {
    if (!idFilterInput.trim()) return [];
    const tokens = idFilterInput.split(/[\s,;]+/);
    const ids: number[] = [];
    for (const token of tokens) {
      if (!token) continue;
      const clean = token.trim().toLowerCase();
      let num: number;
      if (clean.startsWith('0x')) {
        num = parseInt(clean, 16);
      } else if (
        /^[0-9a-f]+$/i.test(clean) &&
        (clean.length === 3 || clean.length === 8)
      ) {
        num = parseInt(clean, 16);
      } else {
        num = parseInt(clean, 10);
      }
      if (!isNaN(num) && !ids.includes(num)) {
        ids.push(num);
      }
    }
    return ids;
  }, [idFilterInput]);

  // Toggle an ID in the filter input
  const handleToggleIdFilter = (id: number) => {
    const hex = `0x${id.toString(16).toUpperCase()}`;
    const currentIds = parsedFilterIds;
    if (currentIds.includes(id)) {
      const remaining = currentIds
        .filter((i) => i !== id)
        .map((i) => `0x${i.toString(16).toUpperCase()}`);
      setIdFilterInput(remaining.join(', '));
    } else {
      const updated = [...currentIds.map((i) => `0x${i.toString(16).toUpperCase()}`), hex];
      setIdFilterInput(updated.join(', '));
    }
  };

  // FPS, ID Frequency, and Threshold Violation Ticker (runs every 1000ms)
  useEffect(() => {
    const interval = setInterval(() => {
      const windowTotal = windowCount.current;
      setCurrentFps(windowTotal);
      windowCount.current = 0;

      // Update sparkline history
      setSparklineHistory((prev) => [...prev.slice(1), windowTotal]);

      // Calculate frequency distribution for each detected CAN ID
      const currentIntervalCounts = idIntervalArrivalsRef.current;
      const lifetimeCounts = idLifetimeTotalsRef.current;
      const metadata = idMetadataRef.current;

      const stats: CanIdStat[] = [];
      const intervalSnapshotBreakdown: TimelinePointData['idBreakdown'] = [];
      const violations: Array<{ id: number; hexId: string; name: string; hz: number; thresholdLimit: number }> = [];

      lifetimeCounts.forEach((totalCount, id) => {
        const intervalArrivals = currentIntervalCounts.get(id) || 0;
        const meta = metadata.get(id) || {
          name: `CAN ID 0x${id.toString(16).toUpperCase()}`,
          isAnomaly: false,
          isExtended: false,
        };
        const percentage =
          windowTotal > 0
            ? Math.round((intervalArrivals / windowTotal) * 100)
            : 0;

        const limit = thresholdRules[id] ?? globalThresholdHz;
        const isOverThreshold = intervalArrivals > limit;

        const statItem: CanIdStat = {
          id,
          hexId: `0x${id.toString(16).toUpperCase().padStart(3, '0')}`,
          name: meta.name,
          isAnomaly: meta.isAnomaly,
          isExtended: meta.isExtended,
          totalCount,
          hz: intervalArrivals,
          percentage,
          thresholdLimit: limit,
          isOverThreshold,
        };

        stats.push(statItem);

        if (isOverThreshold && intervalArrivals > 0) {
          violations.push({
            id,
            hexId: statItem.hexId,
            name: statItem.name,
            hz: intervalArrivals,
            thresholdLimit: limit,
          });
        }

        // If this ID arrived in the latest 1-second interval, record for timeline tooltip
        if (intervalArrivals > 0) {
          intervalSnapshotBreakdown.push({
            id,
            hexId: `0x${id.toString(16).toUpperCase().padStart(3, '0')}`,
            name: meta.name,
            count: intervalArrivals,
            hz: intervalArrivals,
            percentage,
            isAnomaly: meta.isAnomaly || isOverThreshold,
          });
        }
      });

      // Sort by active rate (Hz) descending, then total count
      stats.sort((a, b) => b.hz - a.hz || b.totalCount - a.totalCount);
      setIdFrequencyStats(stats);
      setActiveViolations(violations);

      intervalSnapshotBreakdown.sort((a, b) => b.count - a.count);

      // Append new point to timeline history
      setTimelineSnapshots((prev) => {
        const next = prev.slice(1).map((p, idx) => ({
          ...p,
          secondOffset: idx,
          secondsAgo: 19 - idx,
        }));
        next.push({
          secondOffset: 19,
          secondsAgo: 0,
          totalCount: windowTotal,
          idBreakdown: intervalSnapshotBreakdown,
        });
        return next;
      });

      // Reset interval window counts
      currentIntervalCounts.clear();
    }, 1000);

    return () => clearInterval(interval);
  }, [thresholdRules, globalThresholdHz]);

  const handleClearHistory = () => {
    setPacketHistory([]);
    setFramesReceived(0);
    setFramesForwarded(0);
    setFramesDropped(0);
    setReconnectRetries(0);
    idIntervalArrivalsRef.current.clear();
    idLifetimeTotalsRef.current.clear();
    idMetadataRef.current.clear();
    setIdFrequencyStats([]);
    setActiveViolations([]);
    setSparklineHistory(Array(20).fill(0));
    setTimelineSnapshots(
      Array.from({ length: 20 }, (_, i) => ({
        secondOffset: i,
        secondsAgo: 19 - i,
        totalCount: 0,
        idBreakdown: [],
      }))
    );
  };

  // Synthetic CAN Packet Generator
  const generateAndDispatchFrame = () => {
    const nowUs = Date.now() * 1000;
    const deltaUs = Math.max(10, Math.min(nowUs - lastTsRef.current, 50000));
    lastTsRef.current = nowUs;

    frameIdCounter.current += 1;
    windowCount.current += 1;

    let newFrame: DecodedCanFrame;

    if (preset === 'normal') {
      const signals = [
        {
          id: 0x280,
          name: 'Engine RPM (0x280)',
          dlc: 8,
          gen: () => {
            const rpm = Math.floor(Math.random() * 2500 + 1500);
            return [
              0x11,
              0x22,
              (rpm >> 8) & 0xff,
              rpm & 0xff,
              0x00,
              0x00,
              0x00,
              0x00,
            ];
          },
          decode: (d: number[]) => `${((d[2] << 8) | d[3]).toLocaleString()} RPM`,
        },
        {
          id: 0x284,
          name: 'Wheel Speed (0x284)',
          dlc: 8,
          gen: () => {
            const spd = Math.floor(Math.random() * 40 + 55);
            return [0x00, spd & 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
          },
          decode: (d: number[]) => `${d[1]} km/h`,
        },
        {
          id: 0x190,
          name: 'Steering Angle (0x190)',
          dlc: 4,
          gen: () => {
            const angle = Math.floor(Math.random() * 60 - 30);
            return [angle < 0 ? 0xff : 0x00, Math.abs(angle), 0x00, 0x00];
          },
          decode: (d: number[]) =>
            `${d[0] === 0xff ? '-' : '+'}${d[1]} deg`,
        },
        {
          id: 0x025,
          name: 'Battery Temp (0x025)',
          dlc: 8,
          gen: () => [0x28, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
          decode: (d: number[]) => `${d[0]} °C`,
        },
      ];

      const pick = signals[Math.floor(Math.random() * signals.length)];
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
        isAnomaly: false,
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
        isAnomaly: true,
      };
    } else if (preset === 'fuzzing') {
      const randId = Math.floor(Math.random() * 0x7ff);
      const randPayload = Array.from({ length: 8 }, () =>
        Math.floor(Math.random() * 256)
      );
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
        isAnomaly: true,
      };
    } else if (preset === 'replay_attack') {
      replayIndexRef.current =
        (replayIndexRef.current + 1) % REPLAY_ATTACK_SEQUENCE.length;
      const replayStep = REPLAY_ATTACK_SEQUENCE[replayIndexRef.current];

      newFrame = {
        id: frameIdCounter.current,
        timestampUs: nowUs,
        deltaUs: Math.floor(Math.random() * 40 + 20),
        canId: replayStep.canId,
        rawCanId: replayStep.canId,
        isExtended: replayStep.isExtended,
        isRtr: false,
        isError: false,
        dlc: replayStep.dlc,
        data: [...replayStep.data],
        signalName: replayStep.signalName,
        decodedValue: replayStep.decodedValue,
        isAnomaly: true,
      };
    } else {
      // Spoofed ABS / Critical
      newFrame = {
        id: frameIdCounter.current,
        timestampUs: nowUs,
        deltaUs,
        canId: 0x18daf110,
        rawCanId: 0x18daf110 | 0x80000000,
        isExtended: true,
        isRtr: false,
        isError: false,
        dlc: 8,
        data: [0xff, 0x00, 0xaa, 0x55, 0x12, 0x34, 0x56, 0x78],
        signalName: 'SPOOFED BRAKE/ABS ACTUATION',
        decodedValue: 'CRITICAL EFF CAN ATTACK',
        isAnomaly: true,
      };
    }

    // Intrusion Detection Logic: Inspect for Unexpected or Blacklisted CAN IDs
    let isPotentialAnomaly = false;
    let anomalyReason = '';

    if (BLACKLISTED_CAN_IDS.has(newFrame.canId)) {
      isPotentialAnomaly = true;
      anomalyReason = `Blacklisted ID 0x${newFrame.canId.toString(16).toUpperCase()} detected on bus`;
    } else if (idFilterMode === 'hide' && parsedFilterIds.includes(newFrame.canId)) {
      isPotentialAnomaly = true;
      anomalyReason = `User-blacklisted ID 0x${newFrame.canId.toString(16).toUpperCase()} detected`;
    } else if (!WHITELISTED_CAN_IDS.has(newFrame.canId)) {
      isPotentialAnomaly = true;
      anomalyReason = `Unexpected ID 0x${newFrame.canId.toString(16).toUpperCase()} (Not in vehicle DBC whitelist)`;
    } else if (newFrame.isAnomaly) {
      isPotentialAnomaly = true;
      anomalyReason = newFrame.signalName || 'Anomalous CAN traffic detected';
    }

    newFrame.isPotentialAnomaly = isPotentialAnomaly;
    newFrame.anomalyReason = anomalyReason;

    // Record ID arrivals for frequency visualization
    const currentIntervalCount =
      idIntervalArrivalsRef.current.get(newFrame.canId) || 0;
    idIntervalArrivalsRef.current.set(newFrame.canId, currentIntervalCount + 1);

    const currentTotal =
      idLifetimeTotalsRef.current.get(newFrame.canId) || 0;
    idLifetimeTotalsRef.current.set(newFrame.canId, currentTotal + 1);

    idMetadataRef.current.set(newFrame.canId, {
      name:
        newFrame.signalName ||
        `ID 0x${newFrame.canId.toString(16).toUpperCase()}`,
      isAnomaly: !!newFrame.isAnomaly || isPotentialAnomaly,
      isExtended: newFrame.isExtended,
    });

    setFramesReceived((prev) => prev + 1);

    if (pythonServerOnline) {
      setFramesForwarded((prev) => prev + 1);
    } else {
      setFramesDropped((prev) => prev + 1);
      if (frameIdCounter.current % 15 === 0) {
        setReconnectRetries((prev) => prev + 1);
      }
    }

    // Keep recent 100 packets in history log for user inspection
    setPacketHistory((prev) => [newFrame, ...prev.slice(0, 99)]);
  };

  // Continuous Ingress Loop
  useEffect(() => {
    if (!isRunning) return;

    let delay = 40;
    if (preset === 'dos_flood') delay = 12;
    if (preset === 'fuzzing') delay = 25;
    if (preset === 'replay_attack') delay = 35;

    const interval = setInterval(() => {
      generateAndDispatchFrame();
    }, delay);

    return () => clearInterval(interval);
  }, [isRunning, preset, pythonServerOnline, idFilterMode, parsedFilterIds]);

  // Compute SVG Sparkline Points and Path for 20-second history
  const sparklineSvg = useMemo(() => {
    const data = sparklineHistory;
    const width = 280;
    const height = 48;
    const maxVal = Math.max(...data, 10);
    const minVal = 0;
    const range = maxVal - minVal || 1;

    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - minVal) / range) * (height - 8) - 4;
      return { x, y, val, idx };
    });

    const pathD = `M ${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`;
    const areaD = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} L ${points
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' L ')} L ${width},${height} L 0,${height} Z`;

    const peak = Math.max(...data);
    const avg = Math.round(data.reduce((a, b) => a + b, 0) / data.length);

    return { points, pathD, areaD, peak, avg, width, height, maxVal, minVal, range };
  }, [sparklineHistory]);

  // Handle Mouse Over Sparkline for Hover Tooltips
  const handleSparklineMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.round(ratio * (timelineSnapshots.length - 1));
    setHoveredTimelineIndex(index);
  };

  const activeSnapshot =
    hoveredTimelineIndex !== null && hoveredTimelineIndex >= 0 && hoveredTimelineIndex < timelineSnapshots.length
      ? timelineSnapshots[hoveredTimelineIndex]
      : null;

  const activePoint =
    hoveredTimelineIndex !== null && hoveredTimelineIndex >= 0 && hoveredTimelineIndex < sparklineSvg.points.length
      ? sparklineSvg.points[hoveredTimelineIndex]
      : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Title & Connection Header with GUI / TUI View Mode Switcher */}
      <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wide mb-2">
            <span>INTERACTIVE INGRESS WORKBENCH</span>
            <span>·</span>
            <span>SOCKETCAN & UDS SIMULATOR</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex flex-wrap items-center gap-3">
            <span>Real-Time CAN Bus & Unix Domain Socket Stream</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-3xl leading-relaxed">
            Simulate virtual CAN traffic on <code className="text-emerald-300 bg-slate-900 px-1 py-0.5 rounded font-mono">vcan0</code>,
            configure custom ID packet frequency threshold limits, and switch between GUI and Terminal TUI sniffer modes.
          </p>
        </div>

        {/* View Mode Switcher (GUI Dashboard vs Terminal TUI) & Live Interface Indicator */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* GUI vs TUI Switcher */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-sm">
            <button
              onClick={() => setViewMode('gui')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'gui'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>GUI Workbench</span>
            </button>
            <button
              onClick={() => setViewMode('tui')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'tui'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="flex items-center gap-1">
                <span>Terminal TUI</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              </span>
            </button>
          </div>

          {/* Live Interface Indicator Status Banner */}
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="relative flex h-2.5 w-2.5">
                {isRunning ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                )}
              </span>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                  SocketCAN (vcan0)
                </span>
                <span
                  className={`text-xs font-mono font-bold ${
                    isRunning ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isRunning ? 'Active' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Warning Alert Banner when any CAN ID exceeds its configured frequency limit */}
      {activeViolations.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-950/40 border-2 border-rose-500/70 text-rose-200 text-xs font-mono shadow-xl flex flex-wrap items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-rose-300 uppercase tracking-wider">
                  TRAFFIC FREQUENCY THRESHOLD EXCEEDED WARNING
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-500 text-slate-950 font-bold text-[10px]">
                  {activeViolations.length} VIOLATION{activeViolations.length > 1 ? 'S' : ''}
                </span>
              </div>
              <p className="text-slate-300 mt-1">
                {activeViolations.map((v, i) => (
                  <span key={v.id} className="mr-3">
                    CAN ID <strong className="text-white">{v.hexId}</strong> ({v.name}) transmitting at{' '}
                    <strong className="text-rose-300">{v.hz} Hz</strong> (exceeds limit of {v.thresholdLimit} Hz)
                    {i < activeViolations.length - 1 ? ' · ' : ''}
                  </span>
                ))}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowThresholdSettings(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Configure Frequency Limits</span>
          </button>
        </div>
      )}

      {/* RENDER TERMINAL TUI VIEW WHEN TUI MODE IS SELECTED */}
      {viewMode === 'tui' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-xl">
            <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>TERMINAL USER INTERFACE (TUI) MODE ACTIVE</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">Emulating Linux can-utils (cansniffer & candump)</span>
            </div>
            <button
              onClick={() => setViewMode('gui')}
              className="text-xs text-emerald-400 hover:text-emerald-300 underline font-mono cursor-pointer"
            >
              Switch back to GUI Dashboard →
            </button>
          </div>

          <CanTuiView
            packets={packetHistory}
            isRunning={isRunning}
            onTogglePause={isRunning ? handlePause : handleResume}
            onStepForward={handleStepForward}
            onClearHistory={handleClearHistory}
            onExportCsv={handleExportForensicCsv}
            currentFps={currentFps}
            preset={preset}
            onPresetChange={setPreset}
            thresholdRules={thresholdRules}
            globalThresholdHz={globalThresholdHz}
            isSocketCanActive={isRunning}
          />
        </div>
      ) : (
        /* GUI DASHBOARD WORKBENCH */
        <>
          {/* Control Strip: Playback Controls & Attack Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Playback Controls (Pause, Resume, Step-Forward), Export CSV & Reset */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  {/* Resume Button */}
                  <button
                    onClick={handleResume}
                    disabled={isRunning}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      isRunning
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs cursor-default'
                        : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-900 cursor-pointer'
                    }`}
                    title="Resume real-time packet ingress stream"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume</span>
                  </button>

                  {/* Pause Button */}
                  <button
                    onClick={handlePause}
                    disabled={!isRunning}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      !isRunning
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs cursor-default'
                        : 'text-slate-400 hover:text-amber-300 hover:bg-slate-900 cursor-pointer'
                    }`}
                    title="Freeze packet ingress stream to inspect specific data patterns"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pause</span>
                  </button>

                  {/* Step-Forward Button */}
                  <button
                    onClick={handleStepForward}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md text-slate-300 hover:text-white hover:bg-slate-900 transition-all cursor-pointer"
                    title="Step forward by exactly 1 CAN packet"
                  >
                    <StepForward className="w-3.5 h-3.5" />
                    <span>Step-Forward</span>
                  </button>
                </div>

                {/* Export Forensic CSV Button */}
                <button
                  onClick={handleExportForensicCsv}
                  disabled={packetHistory.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-emerald-500/30 transition-all cursor-pointer shadow-xs"
                  title="Export captured message history to forensic CSV file format"
                >
                  {exportedCsv ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Exported!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Forensic CSV</span>
                    </>
                  )}
                </button>

                {/* Threshold Settings Modal Trigger Button */}
                <button
                  onClick={() => setShowThresholdSettings(!showThresholdSettings)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer shadow-xs ${
                    showThresholdSettings || activeViolations.length > 0
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                  }`}
                  title="Configure custom threshold values for CAN ID packet frequency"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Frequency Thresholds</span>
                  {activeViolations.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                  )}
                </button>

                {/* Reset Stream History */}
                <button
                  onClick={handleClearHistory}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                  title="Reset metrics and clear message log buffer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Log</span>
                </button>
              </div>

              {/* Mock Python UDS Receiver Connection Status */}
              <button
                onClick={() => setPythonServerOnline(!pythonServerOnline)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                  pythonServerOnline
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-400'
                }`}
                title="Click to toggle simulated Python UDS Receiver (/tmp/can_sentinel.sock)"
              >
                {pythonServerOnline ? (
                  <>
                    <Server className="w-3.5 h-3.5 text-emerald-400" />
                    <span>UDS Receiver: CONNECTED</span>
                  </>
                ) : (
                  <>
                    <ServerOff className="w-3.5 h-3.5 text-rose-400" />
                    <span>UDS Receiver: DISCONNECTED</span>
                  </>
                )}
              </button>
            </div>

            {/* Traffic Attack Profile Selector */}
            <div className="pt-3 border-t border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2.5">
                Simulated Ingress Profiles & Security Attack Injections
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <button
                  onClick={() => setPreset('normal')}
                  className={`flex flex-col p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    preset === 'normal'
                      ? 'bg-emerald-500/15 border-emerald-500 text-white ring-1 ring-emerald-500'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-emerald-400">Nominal OEM</span>
                    <Car className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-[11px] text-slate-400 leading-tight">
                    RPM, Speed, Steering, Temp (Balanced bus)
                  </span>
                </button>

                <button
                  onClick={() => setPreset('dos_flood')}
                  className={`flex flex-col p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    preset === 'dos_flood'
                      ? 'bg-red-500/15 border-red-500 text-white ring-1 ring-red-500'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-red-400">DoS Bus Flood</span>
                    <Flame className="w-3.5 h-3.5 text-red-400" />
                  </div>
                  <span className="text-[11px] text-slate-400 leading-tight">
                    ID 0x000 storm overrides CAN arbitration
                  </span>
                </button>

                <button
                  onClick={() => setPreset('fuzzing')}
                  className={`flex flex-col p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    preset === 'fuzzing'
                      ? 'bg-amber-500/15 border-amber-500 text-white ring-1 ring-amber-500'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-amber-400">CAN Fuzzing</span>
                    <Radio className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <span className="text-[11px] text-slate-400 leading-tight">
                    Random arbitration IDs & payload mutation
                  </span>
                </button>

                <button
                  onClick={() => setPreset('spoofed_abs')}
                  className={`flex flex-col p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    preset === 'spoofed_abs'
                      ? 'bg-purple-500/15 border-purple-500 text-white ring-1 ring-purple-500'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-purple-400">Spoofed Brake</span>
                    <AlertTriangle className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <span className="text-[11px] text-slate-400 leading-tight">
                    Critical EFF 29-bit injection (0x18DAF110)
                  </span>
                </button>

                <button
                  onClick={() => setPreset('replay_attack')}
                  className={`flex flex-col p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    preset === 'replay_attack'
                      ? 'bg-cyan-500/15 border-cyan-500 text-white ring-1 ring-cyan-500'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-cyan-400">Replay Attack</span>
                    <Repeat className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <span className="text-[11px] text-slate-400 leading-tight">
                    6-step sequence (Diag, Unlock, Throttle, ABS)
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible / Modal Settings Panel for Defining Custom Threshold Values */}
          {showThresholdSettings && (
            <div className="bg-slate-900 border-2 border-amber-500/50 rounded-xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      CAN ID Packet Frequency Threshold Settings
                    </h3>
                    <p className="text-xs text-slate-400">
                      Configure custom frequency limits (Hz) per CAN ID to trigger real-time visual alerts when traffic exceeds expected levels
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetThresholdRules}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                  <button
                    onClick={() => setShowThresholdSettings(false)}
                    className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Global Default Fallback Rate */}
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-white block">
                    Global Default Frequency Limit
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Applies to any detected CAN ID without a specific per-ID threshold rule
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="5"
                    max="150"
                    step="5"
                    value={globalThresholdHz}
                    onChange={(e) => setGlobalThresholdHz(parseInt(e.target.value, 10))}
                    className="w-32 accent-emerald-500 cursor-pointer"
                  />
                  <span className="font-mono font-bold text-cyan-300 text-sm w-16 text-right">
                    {globalThresholdHz} Hz
                  </span>
                </div>
              </div>

              {/* Add Custom CAN ID Threshold Rule Form */}
              <form
                onSubmit={handleAddOrUpdateThresholdRule}
                className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center gap-3"
              >
                <div className="flex-1 min-w-[160px]">
                  <label className="text-[10px] text-slate-400 uppercase font-mono block mb-1">
                    CAN ID (Hex or Dec)
                  </label>
                  <input
                    type="text"
                    value={newRuleIdInput}
                    onChange={(e) => setNewRuleIdInput(e.target.value)}
                    placeholder="e.g. 0x280 or 0x000"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="w-36">
                  <label className="text-[10px] text-slate-400 uppercase font-mono block mb-1">
                    Max Frequency (Hz)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={newRuleHzInput}
                    onChange={(e) => setNewRuleHzInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="self-end">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save Threshold Rule</span>
                  </button>
                </div>
              </form>

              {/* Current Active Rules List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Configured Threshold Rules ({Object.keys(thresholdRules).length} rules)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {Object.entries(thresholdRules).map(([idStr, maxHz]) => {
                    const idNum = parseInt(idStr, 10);
                    const hexId = `0x${idNum.toString(16).toUpperCase()}`;
                    const activeStat = idFrequencyStats.find((s) => s.id === idNum);
                    const isExceeded = activeStat && activeStat.hz > maxHz;

                    return (
                      <div
                        key={idStr}
                        className={`p-2.5 rounded-lg border text-xs font-mono flex items-center justify-between transition-colors ${
                          isExceeded
                            ? 'bg-rose-950/30 border-rose-500/50 text-rose-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{hexId}</span>
                            {isExceeded && (
                              <span className="px-1 py-0.2 rounded text-[9px] bg-rose-500 text-slate-950 font-bold animate-pulse">
                                OVER LIMIT
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Current: {activeStat ? `${activeStat.hz} Hz` : '0 Hz'} / Limit: {maxHz} Hz
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveThresholdRule(idNum)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded cursor-pointer"
                          title="Remove rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

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
              <span
                className={`text-xl font-bold font-mono tabular-nums ${
                  framesDropped > 0 ? 'text-red-400' : 'text-slate-500'
                }`}
              >
                {framesDropped.toLocaleString()}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <span className="text-xs text-slate-400 block mb-1">Threshold Alerts</span>
              <span
                className={`text-xl font-bold font-mono tabular-nums ${
                  activeViolations.length > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'
                }`}
              >
                {activeViolations.length}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 col-span-2 md:col-span-1">
              <span className="text-xs text-slate-400 block mb-1">Instant Throughput</span>
              <span className="text-xl font-bold font-mono tabular-nums text-cyan-400">
                {currentFps} <span className="text-xs font-normal text-slate-400">fps</span>
              </span>
            </div>
          </div>

          {/* Real-Time Bus Traffic Patterns & CAN ID Frequency Visualizer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Mini Throughput Sparkline with Hover Tooltip */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg relative">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Ingress Traffic Sparkline (20s)
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-cyan-400">
                    {currentFps} fps live
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mb-3">
                  Hover across the timeline curve to inspect exact frame counts and ID frequencies at any second
                </p>

                {/* SVG Sparkline Container with Hover Tooltip */}
                <div
                  className="relative bg-slate-950 rounded-lg p-2.5 border border-slate-850"
                  onMouseLeave={() => setHoveredTimelineIndex(null)}
                >
                  <svg
                    viewBox={`0 0 ${sparklineSvg.width} ${sparklineSvg.height}`}
                    className="w-full h-16 overflow-visible cursor-crosshair select-none"
                    onMouseMove={handleSparklineMouseMove}
                    onMouseLeave={() => setHoveredTimelineIndex(null)}
                  >
                    <defs>
                      <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Gridlines */}
                    <line
                      x1="0"
                      y1={sparklineSvg.height / 2}
                      x2={sparklineSvg.width}
                      y2={sparklineSvg.height / 2}
                      stroke="#1e293b"
                      strokeDasharray="3 3"
                    />

                    {/* Area under curve */}
                    <path d={sparklineSvg.areaD} fill="url(#sparklineGradient)" />

                    {/* Sparkline curve */}
                    <path
                      d={sparklineSvg.pathD}
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Active Hover Marker: vertical line & glowing curve point */}
                    {activePoint && (
                      <>
                        <line
                          x1={activePoint.x}
                          y1={0}
                          x2={activePoint.x}
                          y2={sparklineSvg.height}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                          strokeDasharray="2 2"
                        />
                        <circle
                          cx={activePoint.x}
                          cy={activePoint.y}
                          r="6"
                          fill="#0284c7"
                          fillOpacity="0.3"
                          className="animate-ping"
                        />
                        <circle
                          cx={activePoint.x}
                          cy={activePoint.y}
                          r="4"
                          fill="#38bdf8"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                      </>
                    )}

                    {/* Latest point circle */}
                    {activePoint === null && sparklineHistory.length > 0 && (
                      <circle
                        cx={sparklineSvg.width}
                        cy={
                          sparklineSvg.height -
                          ((currentFps - 0) /
                            (Math.max(...sparklineHistory, 10) || 1)) *
                            (sparklineSvg.height - 8) -
                          4
                        }
                        r="3.5"
                        fill="#10b981"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    )}
                  </svg>

                  {/* Hover-based Timeline Tooltip */}
                  {hoveredTimelineIndex !== null && activeSnapshot && (
                    <div
                      className={`absolute z-40 pointer-events-none transition-all duration-75 shadow-2xl rounded-xl p-3 bg-slate-900/98 backdrop-blur-md border border-cyan-500/50 text-xs text-slate-200 min-w-[250px] max-w-[290px] ${
                        hoveredTimelineIndex > 10 ? 'right-2' : 'left-2'
                      } bottom-full mb-2`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="font-mono font-bold text-white text-[11px]">
                            {activeSnapshot.secondsAgo === 0
                              ? 'T - 0s (Current / Live)'
                              : `T - ${activeSnapshot.secondsAgo}s ago`}
                          </span>
                        </div>
                        <span className="font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px]">
                          {activeSnapshot.totalCount} pkts/s
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between font-mono">
                        <span>Specific Ingress Count:</span>
                        <span className="text-white font-bold">{activeSnapshot.totalCount} packets</span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                          Packet ID Frequencies ({activeSnapshot.idBreakdown.length} active IDs):
                        </span>
                        {activeSnapshot.idBreakdown.length === 0 ? (
                          <span className="text-[11px] text-slate-500 italic block py-1 font-mono">
                            No packets transmitted at this second
                          </span>
                        ) : (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {activeSnapshot.idBreakdown.map((item) => (
                              <div
                                key={item.id}
                                className={`p-1.5 rounded flex items-center justify-between text-[11px] font-mono border ${
                                  item.isAnomaly
                                    ? 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                                    : 'bg-slate-950/80 border-slate-800 text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 truncate max-w-[145px]">
                                  <span className="font-bold text-white">{item.hexId}</span>
                                  <span className="text-[10px] text-slate-400 truncate">
                                    {item.name.replace(/^REPLAY:\s*/, '')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 font-bold shrink-0">
                                  <span className="text-cyan-300">{item.count} pkts</span>
                                  <span className="text-emerald-400 text-[10px]">({item.percentage}%)</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-center text-[11px] font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px]">CURRENT</span>
                  <span className="font-bold text-white">{currentFps} Hz</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">20s PEAK</span>
                  <span className="font-bold text-emerald-400">{sparklineSvg.peak} Hz</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">AVERAGE</span>
                  <span className="font-bold text-cyan-400">{sparklineSvg.avg} Hz</span>
                </div>
              </div>
            </div>

            {/* Right: CAN Packet ID Frequency Distribution Bar Chart with Threshold Warnings */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      CAN Packet ID Frequency Distribution
                    </h3>
                  </div>

                  {/* Threshold Settings Quick Button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowThresholdSettings(!showThresholdSettings)}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                      title="Adjust custom frequency threshold rules"
                    >
                      <Sliders className="w-3 h-3 text-amber-400" />
                      <span>Thresholds ({Object.keys(thresholdRules).length})</span>
                    </button>
                    <span className="text-[11px] font-mono text-slate-400">
                      {idFrequencyStats.length} active IDs
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mb-3">
                  Real-time bus arbitration breakdown with custom threshold limits. Click any ID bar to toggle filtering in the message log.
                </p>

                {/* Frequency Bar Chart */}
                <div className="space-y-2.5 max-h-[175px] overflow-y-auto pr-1">
                  {idFrequencyStats.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      Awaiting frame ingress to compute ID arbitration frequencies...
                    </div>
                  ) : (
                    idFrequencyStats.map((item) => {
                      const isFiltered = parsedFilterIds.includes(item.id);
                      const isOverLimit = item.isOverThreshold;

                      const barColor = isOverLimit
                        ? 'bg-rose-500 animate-pulse'
                        : item.isAnomaly
                        ? 'bg-amber-500'
                        : item.isExtended
                        ? 'bg-purple-500'
                        : 'bg-emerald-500';

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleToggleIdFilter(item.id)}
                          className={`group cursor-pointer p-2.5 rounded-lg border transition-all ${
                            isOverLimit
                              ? 'bg-rose-950/40 border-rose-500/80 ring-1 ring-rose-500/50'
                              : isFiltered
                              ? 'bg-slate-800/90 border-cyan-500/50 ring-1 ring-cyan-500/30'
                              : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white text-[11px]">
                                {item.hexId}
                              </span>
                              <span
                                className={`text-[11px] font-sans truncate max-w-[160px] sm:max-w-[220px] ${
                                  isOverLimit
                                    ? 'text-rose-200 font-bold'
                                    : item.isAnomaly
                                    ? 'text-amber-300 font-semibold'
                                    : 'text-slate-300'
                                }`}
                              >
                                {item.name}
                              </span>

                              {/* Threshold Exceeded Visual Warning Badge */}
                              {isOverLimit ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] bg-rose-500 text-slate-950 font-bold animate-pulse">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>LIMIT EXCEEDED ({item.hz}Hz &gt; {item.thresholdLimit}Hz)</span>
                                </span>
                              ) : item.isAnomaly ? (
                                <span className="px-1 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  ANOMALY
                                </span>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-3 font-mono text-[11px]">
                              <span className={isOverLimit ? 'text-rose-300 font-bold' : 'text-slate-400'}>
                                {item.hz} Hz <span className="text-[10px] text-slate-500">/ {item.thresholdLimit}Hz max</span>
                              </span>
                              <span className="font-bold text-emerald-400 w-10 text-right">
                                {item.percentage}%
                              </span>
                              <span className="text-[10px] text-slate-500 group-hover:text-cyan-400 hidden sm:inline">
                                {isFiltered
                                  ? idFilterMode === 'show'
                                    ? '● Included'
                                    : '● Excluded'
                                  : '+ Filter'}
                              </span>
                            </div>
                          </div>

                          {/* Bar Fill */}
                          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                              style={{ width: `${Math.max(item.percentage, 2)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span>Arbitration order: lower IDs claim bus access first</span>
                <span className="text-slate-400">
                  Total unique IDs seen: {idLifetimeTotalsRef.current.size}
                </span>
              </div>
            </div>
          </div>

          {/* CAN Packet ID Filter Input Field & Whitelist/Blacklist Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Filter Message Log by CAN Packet ID
                </h3>
              </div>

              {/* Whitelist / Blacklist Toggle */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
                <button
                  onClick={() => setIdFilterMode('show')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    idFilterMode === 'show'
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Show Specified IDs</span>
                </button>
                <button
                  onClick={() => setIdFilterMode('hide')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    idFilterMode === 'hide'
                      ? 'bg-rose-500 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Hide Specified IDs</span>
                </button>
              </div>
            </div>

            {/* Text Input Field */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={idFilterInput}
                  onChange={(e) => setIdFilterInput(e.target.value)}
                  placeholder="Enter CAN IDs to filter (e.g. 0x280, 0x190, 0x000, 284)..."
                  className="w-full pl-3 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                {idFilterInput && (
                  <button
                    onClick={() => setIdFilterInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    title="Clear input"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {parsedFilterIds.length > 0 && (
                <button
                  onClick={() => setIdFilterInput('')}
                  className="px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
            </div>

            {/* Quick Clickable ID Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400 mr-1">Active IDs on Bus:</span>
              {idFrequencyStats.length === 0 ? (
                <span className="text-[11px] text-slate-500 font-mono">None detected yet</span>
              ) : (
                idFrequencyStats.map((item) => {
                  const isSelected = parsedFilterIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleToggleIdFilter(item.id)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-all border cursor-pointer ${
                        isSelected
                          ? idFilterMode === 'show'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <span>{item.hexId}</span>
                      {isSelected ? (
                        <X className="w-3 h-3 ml-0.5" />
                      ) : (
                        <Plus className="w-3 h-3 ml-0.5 text-slate-500" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Full-Text Search Enabled Message Log Component */}
          <MessageLog
            packets={packetHistory}
            onClearHistory={handleClearHistory}
            pythonServerOnline={pythonServerOnline}
            idFilterList={parsedFilterIds}
            idFilterMode={idFilterMode}
            onClearIdFilter={() => setIdFilterInput('')}
            onExportCsv={handleExportForensicCsv}
          />
        </>
      )}
    </div>
  );
};
