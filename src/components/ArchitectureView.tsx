import React, { useState } from 'react';
import {
  Cpu,
  Layers,
  Workflow,
  Zap,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Terminal,
  Activity
} from 'lucide-react';

export const ArchitectureView: React.FC = () => {
  const [selectedTopic, setSelectedTopic] = useState<'rcvbuf' | 'monotonic' | 'sigpipe' | 'uds_vs_tcp' | 'zero_alloc'>('zero_alloc');

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Title & Scope */}
      <div className="border-b border-slate-800 pb-6">
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wide mb-2">
          <span>AUTOMOTIVE CYBERSECURITY</span>
          <span>·</span>
          <span>SPRINT WEEK 3</span>
          <span>·</span>
          <span>MEMBER 1: LOW-LEVEL SYSTEMS (C/KERNEL)</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          SocketCAN to Unix Domain Socket Ingestion Pipeline
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-3xl leading-relaxed">
          High-throughput, sub-millisecond IPC architecture capturing raw automotive CAN bus frames
          from Linux kernel network drivers (<code className="text-slate-300">PF_CAN</code>) and streaming byte-aligned binary packets
          over POSIX Unix Domain Sockets to the Member 2 Python ML anomaly detection engine.
        </p>
      </div>

      {/* Core KPI / Latency Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Kernel Ingress Latency</span>
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">&lt; 45 µs</div>
          <p className="text-xs text-slate-500 mt-1">SocketCAN ring to userspace read</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Hot Path Memory Allocs</span>
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">0 Bytes</div>
          <p className="text-xs text-slate-500 mt-1">Zero heap malloc/free in loop</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Peak Sustained Throughput</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">75,000+ fps</div>
          <p className="text-xs text-slate-500 mt-1">vcan0 saturation benchmark</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Wire Packet Footprint</span>
            <Layers className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white">21 Bytes</div>
          <p className="text-xs text-slate-500 mt-1">Exact packed struct alignment</p>
        </div>
      </div>

      {/* End-to-End Pipeline Diagram */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-6 flex items-center gap-2">
          <Workflow className="w-4 h-4 text-emerald-400" />
          <span>End-to-End Automotive Dataflow & Process Boundaries</span>
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 relative">
          {/* Stage 1: Vehicle / Virtual CAN */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">Layer 01</span>
                <span className="text-xs text-slate-500">Hardware / Kernel</span>
              </div>
              <h3 className="text-base font-semibold text-white">Automotive Bus / vcan0</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Raw CAN 2.0A/B differential signals (11-bit standard or 29-bit extended)
                handled by the Linux <code className="text-slate-300">vcan</code> kernel module.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs font-mono text-slate-400 space-y-1">
              <div>Interface: <span className="text-slate-200">vcan0 / can0</span></div>
              <div>Arb ID: <span className="text-slate-200">11-bit / 29-bit</span></div>
              <div>Bitrate: <span className="text-slate-200">500 kbps - 1 Mbps</span></div>
            </div>
          </div>

          {/* Stage 2: SocketCAN Kernel Ring */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">Layer 02</span>
                <span className="text-xs text-slate-500">Kernel Subsystem</span>
              </div>
              <h3 className="text-base font-semibold text-white">Linux SocketCAN</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Network stack interface (<code className="text-slate-300">PF_CAN</code>, <code className="text-slate-300">SOCK_RAW</code>).
                Enlarged <code className="text-slate-300">SO_RCVBUF</code> (512 KiB) prevents frame dropping during DoS bursts.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs font-mono text-slate-400 space-y-1">
              <div>Socket: <span className="text-slate-200">PF_CAN, SOCK_RAW</span></div>
              <div>Binding: <span className="text-slate-200">SIOCGIFINDEX</span></div>
              <div>Ring Buffer: <span className="text-slate-200">512 KiB (~32k frames)</span></div>
            </div>
          </div>

          {/* Stage 3: Member 1 C Client */}
          <div className="bg-slate-950/70 border border-emerald-500/30 rounded-lg p-5 flex flex-col justify-between relative shadow-lg shadow-emerald-950/20">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider font-bold">Layer 03 (Member 1)</span>
                <span className="text-xs text-emerald-400/80 font-mono">Current Focus</span>
              </div>
              <h3 className="text-base font-semibold text-white">can_uds_forwarder.c</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                High-performance C daemon. Ingests raw frames, acquires <code className="text-slate-300">CLOCK_MONOTONIC</code> timestamp,
                packs into 21-byte wire struct, and streams via UDS.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs font-mono text-slate-400 space-y-1">
              <div>Allocations: <span className="text-emerald-400 font-semibold">Zero heap mallocs</span></div>
              <div>Clock: <span className="text-slate-200">CLOCK_MONOTONIC (µs)</span></div>
              <div>Resilience: <span className="text-slate-200">SIGPIPE Ignored + Reconnect</span></div>
            </div>
          </div>

          {/* Stage 4: Member 2 Python ML Ingest */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-purple-400 uppercase tracking-wider">Layer 04 (Member 2)</span>
                <span className="text-xs text-slate-500">Python / ML</span>
              </div>
              <h3 className="text-base font-semibold text-white">uds_receiver.py</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Downstream ingestion engine. Unpacks binary frames using Python's
                native <code className="text-slate-300">struct.unpack('&lt;QIB8s')</code> and feeds ML anomaly models.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs font-mono text-slate-400 space-y-1">
              <div>Transport: <span className="text-slate-200">AF_UNIX SOCK_STREAM</span></div>
              <div>Unpack: <span className="text-slate-200">&lt;QIB8s (21 bytes)</span></div>
              <div>ML Models: <span className="text-slate-200">Isolation Forest / LSTM</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Deep Dive Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>Low-Level Implementation Highlights & Kernel Primitives</span>
        </h2>

        {/* Tab Buttons */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-800 pb-4">
          <button
            onClick={() => setSelectedTopic('zero_alloc')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              selectedTopic === 'zero_alloc'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Zero-Allocation Hot Path
          </button>
          <button
            onClick={() => setSelectedTopic('rcvbuf')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              selectedTopic === 'rcvbuf'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Kernel SO_RCVBUF Tuning
          </button>
          <button
            onClick={() => setSelectedTopic('monotonic')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              selectedTopic === 'monotonic'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            CLOCK_MONOTONIC Precision
          </button>
          <button
            onClick={() => setSelectedTopic('sigpipe')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              selectedTopic === 'sigpipe'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            SIGPIPE Immunity & Reconnect
          </button>
          <button
            onClick={() => setSelectedTopic('uds_vs_tcp')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              selectedTopic === 'uds_vs_tcp'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            UDS vs TCP Loopback
          </button>
        </div>

        {/* Content Section */}
        <div className="text-sm text-slate-300">
          {selectedTopic === 'zero_alloc' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-white font-semibold">Stack-Allocated Frame and Packet Buffers</h4>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    In real-time automotive cybersecurity systems, heap allocations (<code className="text-slate-200">malloc()</code>, <code className="text-slate-200">free()</code>)
                    introduce non-deterministic glibc lock contention and memory fragmentation.
                    In <code className="text-slate-200">can_uds_forwarder.c</code>, both <code className="text-slate-200">struct can_frame</code> (16 bytes)
                    and <code className="text-slate-200">can_uds_packet_t</code> (21 bytes) reside completely on the thread stack:
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-300 overflow-x-auto border border-slate-800">
                <span className="text-slate-500">// Hot Loop in can_uds_forwarder.c:</span><br />
                <span className="text-cyan-400">struct</span> can_frame frame;          <span className="text-slate-500">// Stack: 16 bytes</span><br />
                <span className="text-cyan-400">can_uds_packet_t</span> packet;          <span className="text-slate-500">// Stack: 21 bytes (packed)</span><br />
                <br />
                <span className="text-cyan-400">while</span> (g_running) &#123;<br />
                &nbsp;&nbsp;<span className="text-slate-500">// Direct kernel read into stack buffer</span><br />
                &nbsp;&nbsp;ssize_t nbytes = read(can_fd, &amp;frame, <span className="text-amber-400">sizeof</span>(<span className="text-cyan-400">struct</span> can_frame));<br />
                &nbsp;&nbsp;<span className="text-slate-500">// Fast memcpy of max 8 bytes payload</span><br />
                &nbsp;&nbsp;packet.timestamp_us = get_monotonic_timestamp_us();<br />
                &nbsp;&nbsp;packet.can_id       = frame.can_id;<br />
                &nbsp;&nbsp;packet.dlc          = frame.can_dlc;<br />
                &nbsp;&nbsp;memcpy(packet.data, frame.data, packet.dlc);<br />
                &nbsp;&nbsp;<span className="text-slate-500">// Direct write over Unix socket</span><br />
                &nbsp;&nbsp;send_all(uds_fd, &amp;packet, CAN_UDS_PACKET_SIZE);<br />
                &#125;
              </div>
            </div>
          )}

          {selectedTopic === 'rcvbuf' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-white font-semibold">Tuning SO_RCVBUF to Prevent Buffer Starvation & Dropped Frames</h4>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    Automotive CAN buses run at 500 kbps or 1 Mbps. During a Denial-of-Service (DoS) or arbitration flood attack,
                    bursts of up to 10,000 frames/sec hit the network interface. The standard Linux default socket buffer (~128 KiB or 212 KiB)
                    can overflow if the forwarder process is temporarily preempted by the Linux CFS scheduler.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-300 overflow-x-auto border border-slate-800">
                <span className="text-slate-500">// Enlarge receive queue to 512 KiB (accommodating ~32,000 backlogged frames):</span><br />
                <span className="text-cyan-400">int</span> bufsize = config.rcvbuf_kb * 1024;<br />
                <span className="text-cyan-400">if</span> (setsockopt(s, SOL_SOCKET, SO_RCVBUF, &amp;bufsize, <span className="text-amber-400">sizeof</span>(bufsize)) &lt; 0) &#123;<br />
                &nbsp;&nbsp;fprintf(stderr, <span className="text-emerald-400">"[WARN] Could not set SO_RCVBUF\\n"</span>);<br />
                &#125;
              </div>
            </div>
          )}

          {selectedTopic === 'monotonic' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-white font-semibold">Why CLOCK_MONOTONIC Instead of gettimeofday or CLOCK_REALTIME</h4>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    Downstream ML models rely on exact inter-arrival time deltas (<code className="text-slate-200">Δt</code>)
                    to detect timing anomalies, masquerade attacks, and cyclic broadcast deviations.
                    Standard system wall-clock time (<code className="text-slate-200">CLOCK_REALTIME</code>) can jump backwards or forwards
                    due to NTP synchronizations or leap seconds. <code className="text-slate-200">CLOCK_MONOTONIC</code> guarantees
                    strictly increasing nanosecond progression from system boot.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-300 overflow-x-auto border border-slate-800">
                <span className="text-cyan-400">static inline uint64_t</span> <span className="text-amber-400">get_monotonic_timestamp_us</span>(<span className="text-cyan-400">void</span>) &#123;<br />
                &nbsp;&nbsp;<span className="text-cyan-400">struct</span> timespec ts;<br />
                &nbsp;&nbsp;<span className="text-slate-500">// Fetches non-decreasing hardware clock (vdso accelerated)</span><br />
                &nbsp;&nbsp;clock_gettime(CLOCK_MONOTONIC, &amp;ts);<br />
                &nbsp;&nbsp;<span className="text-cyan-400">return</span> ((<span className="text-cyan-400">uint64_t</span>)ts.tv_sec * 1000000ULL) + ((<span className="text-cyan-400">uint64_t</span>)ts.tv_nsec / 1000ULL);<br />
                &#125;
              </div>
            </div>
          )}

          {selectedTopic === 'sigpipe' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-white font-semibold">Resilience: SIGPIPE Immunity and Automatic Reconnection</h4>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    If Member 2 restarts their Python script, retrains a model, or encounters a crash, writing to a closed Unix socket
                    ordinarily emits <code className="text-slate-200">SIGPIPE</code>, killing the C forwarder.
                    By setting <code className="text-slate-200">signal(SIGPIPE, SIG_IGN)</code> and utilizing <code className="text-slate-200">MSG_NOSIGNAL</code>,
                    <code className="text-slate-200">send()</code> safely returns <code className="text-slate-200">-1</code> with <code className="text-slate-200">errno = EPIPE</code>.
                    The forwarder closes the stale socket and enters a 1-second auto-reconnect backoff while continuing to process or buffer CAN bus ingress.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-300 overflow-x-auto border border-slate-800">
                <span className="text-slate-500">// Setup trap:</span><br />
                signal(SIGPIPE, SIG_IGN);<br />
                <br />
                <span className="text-slate-500">// send_all helper:</span><br />
                ssize_t n = send(fd, ptr + sent, total_bytes - sent, <span className="text-purple-400">MSG_NOSIGNAL</span>);<br />
                <span className="text-cyan-400">if</span> (n &lt; 0 &amp;&amp; (errno == EPIPE || errno == ECONNRESET)) &#123;<br />
                &nbsp;&nbsp;<span className="text-slate-500">// Peer closed cleanly; trigger auto-reconnect state machine</span><br />
                &nbsp;&nbsp;close(uds_fd);<br />
                &nbsp;&nbsp;uds_fd = -1;<br />
                &#125;
              </div>
            </div>
          )}

          {selectedTopic === 'uds_vs_tcp' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-white font-semibold">Unix Domain Sockets (AF_UNIX) vs TCP 127.0.0.1 Loopback</h4>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                    Why did Member 1 select AF_UNIX over TCP loopback or shared memory?
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <span className="text-xs font-semibold text-emerald-400">Unix Domain Sockets (AF_UNIX)</span>
                  <ul className="mt-2 text-xs text-slate-400 space-y-1.5 list-disc pl-4">
                    <li>Zero TCP stack overhead (no IP checksum calculation, no ACK packet overhead).</li>
                    <li>Filesystem-backed permissions (<code className="text-slate-300">chmod 0660</code>) prevent unauthorized processes from spying on CAN data.</li>
                    <li>Operates entirely in kernel memory buffers (<code className="text-slate-300">/tmp</code> tmpfs).</li>
                    <li>Streamlined streaming pipe with clean EOF / disconnect detection.</li>
                  </ul>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <span className="text-xs font-semibold text-amber-400">TCP Loopback (127.0.0.1)</span>
                  <ul className="mt-2 text-xs text-slate-400 space-y-1.5 list-disc pl-4">
                    <li>Traverses full TCP/IP networking stack (packet encapsulation, port routing).</li>
                    <li>Requires open network port; vulnerable to port-scanning or cross-user binds.</li>
                    <li>~2.5x higher CPU cycle overhead compared to AF_UNIX streaming.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
