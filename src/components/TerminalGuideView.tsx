import React, { useState } from 'react';
import { Terminal, Copy, Check, CheckCircle2, ChevronRight, Play } from 'lucide-react';

interface GuideStep {
  number: string;
  title: string;
  description: string;
  command: string;
  terminalOutput: string;
  terminalContext: string;
}

const STEPS: GuideStep[] = [
  {
    number: '01',
    title: 'Install Linux Kernel Modules & SocketCAN Tools',
    description: 'Ensure system build essentials, Linux kernel utilities (iproute2), and automotive can-utils are present.',
    command: 'sudo apt-get update && sudo apt-get install -y build-essential gcc iproute2 can-utils python3',
    terminalContext: 'Host Terminal (Root/Sudo)',
    terminalOutput: `Reading package lists... Done
Building dependency tree... Done
The following NEW packages will be installed:
  can-utils (2020.12.0-1)
  iproute2 (5.15.0-1ubuntu0.1)
Setting up can-utils ...
Setting up iproute2 ...
Processing triggers for man-db ...
Done.`
  },
  {
    number: '02',
    title: 'Initialize Virtual CAN Interface (vcan0)',
    description: 'Load the kernel vcan module and bring up the virtual CAN network interface device.',
    command: 'sudo modprobe vcan && sudo ip link add dev vcan0 type vcan && sudo ip link set up vcan0',
    terminalContext: 'Host Terminal (Root/Sudo)',
    terminalOutput: `[sudo] password for engineer:
# Kernel virtual CAN driver activated
# Verifying interface status:
$ ip link show vcan0
4: vcan0: <NOARP,UP,LOWER_UP> mtu 72 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000
    link/can`
  },
  {
    number: '03',
    title: 'Compile C Forwarder via Optimized Makefile',
    description: 'Compile can_uds_forwarder.c with -O3 optimizations, -pthread, and static assertion verification.',
    command: 'cd c_client && make clean && make',
    terminalContext: 'Terminal: c_client Directory',
    terminalOutput: `rm -f can_uds_forwarder.o can_uds_forwarder
[CC] Compiling can_uds_forwarder.c
[LD] Linking can_uds_forwarder
==========================================================
 Build Success: ./can_uds_forwarder
 Flags: -O3 -Wall -Wextra -pedantic -std=gnu11 -pthread -D_GNU_SOURCE
 Run './can_uds_forwarder --help' for usage options.
==========================================================`
  },
  {
    number: '04',
    title: 'Launch Member 2 Downstream Python Receiver',
    description: 'Start the Python UDS server to listen on /tmp/can_sentinel.sock and unpack binary frames.',
    command: 'cd python_receiver && python3 uds_receiver.py -v',
    terminalContext: 'Terminal 1: Member 2 (Python ML Engine)',
    terminalOutput: `===================================================================
 CAN-Sentinel :: Downstream Python ML Ingestion Listener
 Socket Path   : /tmp/can_sentinel.sock
 Wire Contract : <QIB8s (21 bytes per frame)
 Press Ctrl+C to stop.
===================================================================
[ML-INGEST] Listening for C forwarder on Unix socket: /tmp/can_sentinel.sock
[ML-INGEST] C Client connected! Ingesting binary stream...`
  },
  {
    number: '05',
    title: 'Start Member 1 C SocketCAN Forwarder',
    description: 'Bind SocketCAN to vcan0, set 512 KiB receive buffer, connect to /tmp/can_sentinel.sock, and stream.',
    command: './can_uds_forwarder -i vcan0 -s /tmp/can_sentinel.sock -v',
    terminalContext: 'Terminal 2: Member 1 (C Low-Level Forwarder)',
    terminalOutput: `===================================================================
 CAN-Sentinel :: SocketCAN to UDS Streaming Bridge (Member 1)
 CAN Interface : vcan0
 UDS Endpoint  : /tmp/can_sentinel.sock
 Buffer Size   : 512 KiB
 Packet Size   : 21 bytes (Packed alignment: #pragma pack(1))
 Verbose Mode  : ENABLED
===================================================================
[CAN] Successfully bound SocketCAN on 'vcan0' (ifindex: 4, RCVBUF: 512 KB)
[UDS] Connected to Python ingestion engine at '/tmp/can_sentinel.sock'
[STATUS] Engine initialized. Entering event forwarding loop...`
  },
  {
    number: '06',
    title: 'Inject CAN Bus Frames via cansend & cangen',
    description: 'Inject diagnostic telemetry frames and high-density random bursts onto the virtual bus.',
    command: 'cansend vcan0 280#1122334455667788 && cangen vcan0 -g 1 -v',
    terminalContext: 'Terminal 3: Traffic Generator',
    terminalOutput: `cansend vcan0 280#1122334455667788
cangen vcan0 -g 1 -v
  vcan0  280   [8]  11 22 33 44 55 66 77 88
  vcan0  1F4   [8]  A0 B1 C2 D3 E4 F5 06 17
  vcan0  310   [4]  DE AD BE EF
  vcan0  025   [2]  05 1F
# Ingress streaming at 1,000 frames/sec...`
  },
  {
    number: '07',
    title: 'High-Volume Saturation Stress Test Benchmark',
    description: 'Inject 50,000 continuous CAN frames with zero inter-frame gap to verify zero buffer drops.',
    command: './scripts/benchmark.sh vcan0 50000 0',
    terminalContext: 'Terminal 3: Performance Benchmark',
    terminalOutput: `==================================================================
 CAN-Sentinel Benchmark & Flood Injector
 Target Interface : vcan0
 Total Frames    : 50000
 Inter-Frame Gap : 0 ms (Maximum wire saturation)
==================================================================
[INFO] Injecting 50000 CAN frames into vcan0...
==================================================================
 Injection Completed in 0.621 seconds
 Effective Ingress Rate: 80,515.3 frames/sec
 Verified: 50,000 frames unpacked with 0 drops across UDS.
==================================================================`
  }
];

export const TerminalGuideView: React.FC = () => {
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const activeStep = STEPS[activeStepIndex];

  const handleCopy = (command: string, index: number) => {
    navigator.clipboard.writeText(command);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Title */}
      <div className="border-b border-slate-800 pb-6">
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wide mb-2">
          <span>OPERATIONAL RUNBOOK</span>
          <span>·</span>
          <span>TERMINAL SETUP & VALIDATION</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Step-by-Step Terminal Execution & Benchmarking
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-3xl leading-relaxed">
          Follow these sequential command steps in your Linux terminal to configure the virtual CAN network device,
          compile the C forwarder, run the Python ML listener, and benchmark raw packet throughput.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Step Navigation Sidebar (5 cols) */}
        <div className="lg:col-span-5 space-y-2">
          {STEPS.map((step, idx) => {
            const isActive = idx === activeStepIndex;
            return (
              <button
                key={step.number}
                onClick={() => setActiveStepIndex(idx)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                  isActive
                    ? 'bg-slate-850 border-emerald-500/50 shadow-md shadow-emerald-950/20'
                    : 'bg-slate-900 border-slate-800 hover:bg-slate-850/60'
                }`}
              >
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded mt-0.5 ${
                    isActive ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {step.number}
                </span>

                <div className="min-w-0 flex-1">
                  <h3 className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>
                    {step.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{step.description}</p>
                </div>

                <ChevronRight
                  className={`w-4 h-4 mt-1 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-600'}`}
                />
              </button>
            );
          })}
        </div>

        {/* Step Execution & Simulated Terminal View (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Active Step Details */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider font-semibold">
                Step {activeStep.number} of {STEPS.length}
              </span>
              <span className="text-xs text-slate-500">{activeStep.terminalContext}</span>
            </div>

            <h2 className="text-lg font-bold text-white mb-2">{activeStep.title}</h2>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">{activeStep.description}</p>

            {/* Command Copy Box */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs">
              <span className="text-emerald-400 truncate mr-3 select-all">$ {activeStep.command}</span>
              <button
                onClick={() => handleCopy(activeStep.command, activeStepIndex)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors shrink-0"
              >
                {copiedIndex === activeStepIndex ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Simulated Terminal Window */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/40"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/40"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/40"></span>
                <span className="ml-2 text-slate-300 font-semibold">{activeStep.terminalContext}</span>
              </div>
              <span className="text-slate-500 text-[11px]">bash 5.2</span>
            </div>

            <div className="p-4 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed max-h-[380px] overflow-y-auto">
              <div className="text-emerald-400 mb-2 font-semibold select-none">$ {activeStep.command}</div>
              <pre className="text-slate-400 whitespace-pre-wrap">{activeStep.terminalOutput}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
