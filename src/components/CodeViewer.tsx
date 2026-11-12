import React, { useState } from 'react';
import { CODE_FILES, CodeFile } from '../data/sourceCodes';
import { Copy, Check, Download, FileCode, Terminal, Sparkles } from 'lucide-react';

export const CodeViewer: React.FC = () => {
  const [selectedFileId, setSelectedFileId] = useState<string>('can_packet_h');
  const [copied, setCopied] = useState<boolean>(false);

  const activeFile: CodeFile = CODE_FILES.find((f) => f.id === selectedFileId) || CODE_FILES[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activeFile.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Title */}
      <div className="border-b border-slate-800 pb-6">
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono tracking-wide mb-2">
          <span>SOURCE CODE ARTIFACTS</span>
          <span>·</span>
          <span>PRODUCTION-READY DELIVERABLES</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Engineered Deliverables & Implementation Files
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-3xl leading-relaxed">
          Complete, production-tested source code files designed with zero-heap hot loops,
          exact 21-byte wire alignment, POSIX signal resilience, and companion testing harnesses.
        </p>
      </div>

      {/* File Selector Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {CODE_FILES.map((file) => (
          <button
            key={file.id}
            onClick={() => setSelectedFileId(file.id)}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              selectedFileId === file.id
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono">{file.filename}</span>
          </button>
        ))}
      </div>

      {/* Active File Meta Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">
              {activeFile.path}
            </span>
            <span className="text-xs text-slate-400">· {activeFile.role}</span>
          </div>
          <p className="text-xs text-slate-300 mt-1.5">{activeFile.description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy Code'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Code Display Area */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/40"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/40"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/40"></span>
            <span className="ml-2 text-slate-300 font-semibold">{activeFile.filename}</span>
          </div>
          <span className="text-slate-500">{activeFile.content.split('\n').length} lines</span>
        </div>

        <div className="p-4 overflow-x-auto max-h-[600px] overflow-y-auto">
          <pre className="font-mono text-xs text-slate-300 leading-relaxed">
            <code>{activeFile.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
