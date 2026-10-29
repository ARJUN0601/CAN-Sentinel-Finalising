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
}

export type ActiveTab = 'architecture' | 'binary' | 'code' | 'simulator' | 'guide';

export type TrafficPreset = 'normal' | 'dos_flood' | 'fuzzing' | 'spoofed_abs' | 'idle';
