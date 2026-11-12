import React, { useState } from 'react';
import { Layers, Binary, Code2, ShieldAlert, Cpu } from 'lucide-react';

interface ByteDescriptor {
  offset: number;
  hexOffset: string;
  field: string;
  type: string;
  size: number;
  description: string;
  colorClass: string;
  pythonFormat: string;
}

export const BinaryMemoryInspector: React.FC = () => {
  // Interactive Packet Configurator State
  const [canIdHex, setCanIdHex] = useState('280');
  const [isExtended, setIsExtended] = useState(false);
  const [isRtr, setIsRtr] = useState(false);
  const [isError, setIsError] = useState(false);
  const [dlc, setDlc] = useState(8);
  const [payloadHex, setPayloadHex] = useState('11 22 33 44 55 66 77 88');
  const [selectedByteOffset, setSelectedByteOffset] = useState<number | null>(null);

  // Compute Raw CAN ID with bit flags
  const parsedId = parseInt(canIdHex, 16) || 0;
  let rawCanId = parsedId;
  if (isExtended) rawCanId |= 0x80000000;
  if (isRtr) rawCanId |= 0x40000000;
  if (isError) rawCanId |= 0x20000000;

  // Clean payload bytes
  const cleanPayload = payloadHex.replace(/[^0-9a-fA-F]/g, '');
  const byteValues: number[] = [];
  for (let i = 0; i < 8; i++) {
    if (i < dlc && i * 2 < cleanPayload.length) {
      byteValues.push(parseInt(cleanPayload.substr(i * 2, 2), 16) || 0);
    } else {
      byteValues.push(0);
    }
  }

  // Simulated current timestamp
  const sampleTimestamp = BigInt(1742081234567890);

  // Build the 21-byte array for memory layout
  const packetBytes = new Uint8Array(21);
  const view = new DataView(packetBytes.buffer);
  view.setBigUint64(0, sampleTimestamp, true); // Little endian
  view.setUint32(8, rawCanId >>> 0, true);     // Little endian
  view.setUint8(12, dlc);
  for (let i = 0; i < 8; i++) {
    view.setUint8(13 + i, byteValues[i]);
  }

  const getByteMeta = (offset: number): ByteDescriptor => {
    if (offset < 8) {
      return {
        offset,
        hexOffset: `0x${offset.toString(16).padStart(2, '0').toUpperCase()}`,
        field: 'timestamp_us',
        type: 'uint64_t',
        size: 8,
        description: 'Monotonic microsecond timestamp from clock_gettime(CLOCK_MONOTONIC)',
        colorClass: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
        pythonFormat: 'Q (unsigned 64-bit int)',
      };
    } else if (offset < 12) {
      return {
        offset,
        hexOffset: `0x${offset.toString(16).padStart(2, '0').toUpperCase()}`,
        field: 'can_id',
        type: 'uint32_t',
        size: 4,
        description: 'CAN Arbitration ID with EFF/RTR/ERR bit flags (Bit 31=EFF, 30=RTR, 29=ERR)',
        colorClass: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300',
        pythonFormat: 'I (unsigned 32-bit int)',
      };
    } else if (offset === 12) {
      return {
        offset,
        hexOffset: `0x${offset.toString(16).padStart(2, '0').toUpperCase()}`,
        field: 'dlc',
        type: 'uint8_t',
        size: 1,
        description: 'Data Length Code (0 to 8 bytes for classical CAN 2.0A/B)',
        colorClass: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
        pythonFormat: 'B (unsigned 8-bit char)',
      };
    } else {
      return {
        offset,
        hexOffset: `0x${offset.toString(16).padStart(2, '0').toUpperCase()}`,
        field: `data[${offset - 13}]`,
        type: 'uint8_t',
        size: 8,
        description: `CAN payload byte index ${offset - 13} (zero-padded if DLC < 8)`,
        colorClass: 'bg-purple-500/15 border-purple-500/40 text-purple-300',
        pythonFormat: '8s or 8B (8 raw bytes)',
      };
    }
  };

  const selectedMeta = selectedByteOffset !== null ? getByteMeta(selectedByteOffset) : null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Title */}
      <div className="border-b border-slate-800 pb-6">
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wide mb-2">
          <span>BINARY WIRE PROTOCOL SPECIFICATION</span>
          <span>·</span>
          <span>can_packet.h</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          21-Byte Packed Binary Struct Alignment
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-3xl leading-relaxed">
          The IPC contract between Member 1 (C forwarder) and Member 2 (Python ML ingestion engine)
          enforces strict 1-byte alignment via <code className="text-slate-300">#pragma pack(push, 1)</code>.
          Zero compiler padding holes guarantee seamless, zero-copy serialization and immediate unpacking via
          Python's <code className="text-slate-300">struct.unpack('&lt;QIB8s')</code>.
        </p>
      </div>

      {/* Memory Map Interactive Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Binary className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Continuous Byte Memory Map (Total = 21 Bytes)</h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Wire Size: <strong className="text-emerald-400 font-bold">21 Bytes</strong> (0x00 - 0x14)
          </span>
        </div>

        {/* 21 Bytes Visual Blocks */}
        <div className="grid grid-cols-3 sm:grid-cols-7 lg:grid-cols-21 gap-2 pt-2 pb-4">
          {Array.from({ length: 21 }).map((_, idx) => {
            const meta = getByteMeta(idx);
            const val = packetBytes[idx];
            const isSelected = selectedByteOffset === idx;

            return (
              <button
                key={idx}
                onClick={() => setSelectedByteOffset(idx)}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                  meta.colorClass
                } ${isSelected ? 'ring-2 ring-white scale-105 z-10' : 'hover:scale-102'}`}
              >
                <span className="text-[10px] font-mono opacity-60">{meta.hexOffset}</span>
                <span className="text-sm font-bold font-mono my-0.5">
                  0x{val.toString(16).padStart(2, '0').toUpperCase()}
                </span>
                <span className="text-[9px] font-mono truncate w-full text-center">
                  {idx < 8 ? `ts[${idx}]` : idx < 12 ? `id[${idx-8}]` : idx === 12 ? 'dlc' : `d[${idx-13}]`}
                </span>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs pt-3 border-t border-slate-800 text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/50"></span>
            <span>timestamp_us (8B, 0x00-0x07)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-cyan-500/20 border border-cyan-500/50"></span>
            <span>can_id + flags (4B, 0x08-0x0B)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/50"></span>
            <span>dlc (1B, 0x0C)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500/50"></span>
            <span>data[8] (8B, 0x0D-0x14)</span>
          </div>
        </div>

        {/* Selected Byte Detail Inspector */}
        {selectedMeta && (
          <div className="mt-5 p-4 rounded-lg bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 bg-slate-800 text-white rounded">
                  Offset {selectedMeta.hexOffset} (Byte {selectedMeta.offset}/21)
                </span>
                <span className="text-sm font-semibold text-white font-mono">
                  {selectedMeta.field} : {selectedMeta.type}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{selectedMeta.description}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs text-slate-400">Python Unpack Mapping:</span>
              <div className="text-xs font-mono text-emerald-400 font-semibold">{selectedMeta.pythonFormat}</div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Custom Packet Builder & Dual-Language Unpacker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Interactive CAN Packet Configurator */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>Interactive CAN Frame Configurator</span>
          </h2>

          <div className="space-y-4 text-xs">
            {/* CAN ID */}
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                CAN Arbitration ID (Hexadecimal):
              </label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-500 text-sm">0x</span>
                <input
                  type="text"
                  value={canIdHex}
                  onChange={(e) => setCanIdHex(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 8))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. 280 (RPM) or 18DAF110 (Diag)"
                />
              </div>
            </div>

            {/* Flags */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-slate-400 font-medium">SocketCAN Bit Flags:</span>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isExtended}
                    onChange={(e) => setIsExtended(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0"
                  />
                  <span className="text-slate-300">CAN_EFF_FLAG (Extended 29-bit ID, 0x80000000)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRtr}
                    onChange={(e) => setIsRtr(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0"
                  />
                  <span className="text-slate-300">CAN_RTR_FLAG (Remote Request, 0x40000000)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isError}
                    onChange={(e) => setIsError(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0"
                  />
                  <span className="text-slate-300">CAN_ERR_FLAG (Error Frame, 0x20000000)</span>
                </label>
              </div>
            </div>

            {/* DLC */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-300 font-medium">Data Length Code (DLC): {dlc} Bytes</label>
                <span className="text-slate-500 font-mono">0 - 8 Bytes</span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                value={dlc}
                onChange={(e) => setDlc(parseInt(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Payload */}
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Payload Bytes (Hex space-separated or raw):
              </label>
              <input
                type="text"
                value={payloadHex}
                onChange={(e) => setPayloadHex(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="11 22 33 44 55 66 77 88"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Remaining bytes automatically padded with 0x00 in C struct.
              </span>
            </div>

            {/* Calculated Raw 32-bit CAN ID */}
            <div className="p-3 bg-slate-950 rounded border border-slate-800 font-mono text-xs text-slate-400 space-y-1">
              <div>Effective Arb ID : <span className="text-white font-bold">0x{parsedId.toString(16).toUpperCase()}</span></div>
              <div>Encoded 32-bit ID : <span className="text-cyan-400 font-bold">0x{(rawCanId >>> 0).toString(16).toUpperCase()}</span></div>
            </div>
          </div>
        </div>

        {/* Right: Live C vs Python Interop Representation */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <span>Cross-Language Code Mapping</span>
            </h2>

            {/* C Struct Initialization */}
            <div className="space-y-3">
              <div>
                <span className="text-xs font-mono text-slate-400">C Struct in can_uds_forwarder.c:</span>
                <div className="mt-1 bg-slate-950 p-3 rounded font-mono text-xs text-slate-300 border border-slate-800 overflow-x-auto">
                  <span className="text-cyan-400">can_uds_packet_t</span> pkt = &#123;<br />
                  &nbsp;&nbsp;.timestamp_us = <span className="text-amber-400">{sampleTimestamp.toString()}ULL</span>,<br />
                  &nbsp;&nbsp;.can_id = <span className="text-cyan-400">0x{(rawCanId >>> 0).toString(16).toUpperCase()}U</span>,<br />
                  &nbsp;&nbsp;.dlc = <span className="text-amber-400">{dlc}</span>,<br />
                  &nbsp;&nbsp;.data = &#123; {byteValues.map(b => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`).join(', ')} &#125;<br />
                  &#125;;
                </div>
              </div>

              {/* Python struct.unpack */}
              <div>
                <span className="text-xs font-mono text-slate-400">Python Member 2 Unpack in uds_receiver.py:</span>
                <div className="mt-1 bg-slate-950 p-3 rounded font-mono text-xs text-slate-300 border border-slate-800 overflow-x-auto">
                  <span className="text-slate-500"># Format: &lt; (little-endian), Q (uint64), I (uint32), B (uint8), 8s (payload)</span><br />
                  ts_us, raw_id, dlc, payload = struct.unpack(<span className="text-emerald-400">"&lt;QIB8s"</span>, raw_bytes)<br />
                  <br />
                  <span className="text-slate-500"># Decoded values:</span><br />
                  ts_us&nbsp;&nbsp;&nbsp;&nbsp;= <span className="text-amber-400">{sampleTimestamp.toString()}</span><br />
                  raw_id&nbsp;&nbsp;&nbsp;= <span className="text-cyan-400">0x{(rawCanId >>> 0).toString(16).toUpperCase()}</span><br />
                  can_id&nbsp;&nbsp;&nbsp;= <span className="text-cyan-400">0x{parsedId.toString(16).toUpperCase()}</span> ({isExtended ? 'Extended 29-bit' : 'Standard 11-bit'})<br />
                  dlc&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= <span className="text-amber-400">{dlc}</span><br />
                  payload&nbsp;&nbsp;= <span className="text-purple-400">b'{byteValues.slice(0, dlc).map(b => `\\x${b.toString(16).padStart(2, '0')}`).join('')}'</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Static Validation: _Static_assert(sizeof(can_uds_packet_t) == 21)</span>
            <span className="text-emerald-400 font-mono">PASSED</span>
          </div>
        </div>
      </div>
    </div>
  );
};
