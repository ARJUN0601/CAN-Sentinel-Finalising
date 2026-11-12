export interface DecodedCanFrame {
  id: number;
  timestampUs: number;
  deltaUs: number;
  canId: number;
  rawCanId: number;
  isExtended: boolean;
  isRtr: boolean;
  isError: boolean;
  dlc: number;
  data: number[];
  signalName?: string;
  decodedValue?: string;
  isAnomaly?: boolean;
  isPotentialAnomaly?: boolean;
  anomalyReason?: string;
  isOverThreshold?: boolean;
}

export interface FrequencyThresholdRule {
  id: number;
  maxHz: number;
  label?: string;
}

export type ActiveTab = 'architecture' | 'binary' | 'code' | 'simulator' | 'tui' | 'guide';

export type TrafficPreset = 'normal' | 'dos_flood' | 'fuzzing' | 'spoofed_abs' | 'replay_attack' | 'idle';
