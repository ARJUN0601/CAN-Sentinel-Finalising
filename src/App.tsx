/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ActiveTab } from './types/can';
import { Header } from './components/Header';
import { ArchitectureView } from './components/ArchitectureView';
import { BinaryMemoryInspector } from './components/BinaryMemoryInspector';
import { CodeViewer } from './components/CodeViewer';
import { SimulatorView } from './components/SimulatorView';
import { TerminalGuideView } from './components/TerminalGuideView';
import { CODE_FILES } from './data/sourceCodes';
import { Download, FileCode, Check, X, Archive, Sparkles } from 'lucide-react';
import JSZip from 'jszip';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('architecture');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [downloadedZip, setDownloadedZip] = useState<boolean>(false);
  const [isSocketCanActive, setIsSocketCanActive] = useState<boolean>(true);

  const handleDownloadSingle = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadZipArchive = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // Top-level README
      zip.file(
        'README.md',
        `# CAN-Sentinel: Low-Level SocketCAN to UDS Pipeline
Automotive Cybersecurity IDS - Week 3 Sprint
Role: Member 1 (Low-Level Systems & Embedded C Engineer)

Deliverables:
- c_client/can_packet.h
- c_client/can_uds_forwarder.c
- c_client/Makefile
- python_receiver/uds_receiver.py
- scripts/setup_vcan.sh
- scripts/benchmark.sh
- docs/SETUP_AND_VERIFICATION.md

See docs/SETUP_AND_VERIFICATION.md for full execution instructions.
`
      );

      // Add each file into its exact folder hierarchy
      CODE_FILES.forEach((file) => {
        zip.file(file.path, file.content);
      });

      // Verification doc
      zip.file(
        'docs/SETUP_AND_VERIFICATION.md',
        `# CAN-Sentinel Setup and Verification Guide
Member 1: Low-Level Systems & Embedded C Engineer

1. sudo ./scripts/setup_vcan.sh
2. cd c_client && make
3. cd python_receiver && python3 uds_receiver.py -v
4. cd c_client && ./can_uds_forwarder -i vcan0 -s /tmp/can_sentinel.sock -v
5. cansend vcan0 280#1122334455667788
`
      );

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'can_sentinel_member1.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadedZip(true);
      setTimeout(() => setDownloadedZip(false), 3000);
    } catch (err) {
      console.error('Failed to generate zip:', err);
      // Fallback to static zip
      const link = document.createElement('a');
      link.href = '/can_sentinel_member1.zip';
      link.download = 'can_sentinel_member1.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* 3-Zone Top Bar Contract */}
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onDownloadAll={() => setShowExportModal(true)}
        socketCanState={isSocketCanActive ? 'Active' : 'Disconnected'}
        onToggleSocketCan={() => setIsSocketCanActive((prev) => !prev)}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-8 pb-16 max-w-7xl mx-auto w-full">
        {activeTab === 'architecture' && <ArchitectureView />}
        {activeTab === 'binary' && <BinaryMemoryInspector />}
        {activeTab === 'code' && <CodeViewer />}
        {activeTab === 'simulator' && (
          <SimulatorView
            isSocketCanActive={isSocketCanActive}
            onToggleSocketCan={(forced?: boolean) => {
              if (typeof forced === 'boolean') {
                setIsSocketCanActive(forced);
              } else {
                setIsSocketCanActive((prev) => !prev);
              }
            }}
            initialViewMode="gui"
          />
        )}
        {activeTab === 'tui' && (
          <SimulatorView
            isSocketCanActive={isSocketCanActive}
            onToggleSocketCan={(forced?: boolean) => {
              if (typeof forced === 'boolean') {
                setIsSocketCanActive(forced);
              } else {
                setIsSocketCanActive((prev) => !prev);
              }
            }}
            initialViewMode="tui"
          />
        )}
        {activeTab === 'guide' && <TerminalGuideView />}
      </main>

      {/* Export All Deliverables Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Export Sprint Deliverables</h3>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Download the complete production-grade source code bundle for CAN-Sentinel Member 1:
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {CODE_FILES.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono text-slate-200">{file.filename}</span>
                  </div>
                  <button
                    onClick={() => handleDownloadSingle(file.filename, file.content)}
                    className="text-slate-400 hover:text-emerald-400 px-2 py-0.5 rounded text-[11px] hover:bg-slate-800"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
              <button
                onClick={handleDownloadZipArchive}
                disabled={isZipping}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded-lg transition-colors cursor-pointer"
              >
                {downloadedZip ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Downloaded ZIP Archive!</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-3.5 h-3.5" />
                    <span>{isZipping ? 'Creating ZIP...' : 'Download .ZIP Archive'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editorial Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">CAN-Sentinel</span>
            <span>·</span>
            <span>Automotive Intrusion Detection System</span>
            <span>·</span>
            <span>Week 3 Sprint</span>
          </div>
          <div>
            <span>Member 1: Low-Level Engineering (SocketCAN, C, Kernel, POSIX UDS)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
