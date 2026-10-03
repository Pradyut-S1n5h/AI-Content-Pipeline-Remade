import React, { useRef } from 'react';
import { Project } from '../../types';
import {
  downloadText,
  downloadBlob,
  exportScriptAsMarkdown,
  exportScriptAsFountain,
  exportScenesAsCSV,
  openPrintableStoryboard,
} from '../../utils/exportUtils';
import {
  Download,
  FileText,
  Table,
  Printer,
  Package,
  Video,
  Upload,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

interface ExportStageProps {
  project: Project;
  onImportProject: (imported: Project) => void;
}

export const ExportStage: React.FC<ExportStageProps> = ({
  project,
  onImportProject,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const meta = project.metadata;
  const slug = meta.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');

  const handleExportMarkdown = () => {
    const md = exportScriptAsMarkdown(project);
    downloadText(md, `${slug}_screenplay.md`, 'text/markdown');
  };

  const handleExportFountain = () => {
    const fountain = exportScriptAsFountain(project);
    downloadText(fountain, `${slug}_screenplay.fountain`, 'text/plain');
  };

  const handleExportScriptText = () => {
    const txt = project.script?.fullScript || '';
    downloadText(txt, `${slug}_screenplay.txt`, 'text/plain');
  };

  const handleExportScriptJson = () => {
    const json = JSON.stringify(project.script, null, 2);
    downloadText(json, `${slug}_script.json`, 'application/json');
  };

  const handleExportScenesCSV = () => {
    const csv = exportScenesAsCSV(project.scenes);
    downloadText(csv, `${slug}_scenes.csv`, 'text/csv');
  };

  const handleExportScenesJson = () => {
    const json = JSON.stringify(project.scenes, null, 2);
    downloadText(json, `${slug}_scenes.json`, 'application/json');
  };

  const handleExportProjectBackup = () => {
    const json = JSON.stringify(project, null, 2);
    downloadText(json, `${slug}_scenecraft_project.json`, 'application/json');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = event.target?.result as string;
        const parsed = JSON.parse(raw);
        if (parsed.metadata && parsed.script && parsed.scenes) {
          onImportProject(parsed);
          alert('Project imported successfully!');
        } else {
          alert('Invalid SceneCraft project JSON format.');
        }
      } catch {
        alert('Failed to parse project JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-8">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5">
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <span>Export Suite & Deliverables</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Export your screenplay, scene breakdown, printable storyboard, project archive, and media.
        </p>
      </div>

      {/* Export Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Screenplay Deliverables */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-amber-400">
              <FileText className="w-5 h-5" />
              <h2 className="text-sm font-semibold text-zinc-100">Screenplay Formats</h2>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Download your complete script, logline, and synopsis formatted for standard production pipelines.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800 text-xs">
            <button
              onClick={handleExportFountain}
              className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 p-2 rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Fountain (.fountain)</span>
            </button>

            <button
              onClick={handleExportMarkdown}
              className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 p-2 rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Markdown (.md)</span>
            </button>

            <button
              onClick={handleExportScriptText}
              className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 p-2 rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Plain Text (.txt)</span>
            </button>

            <button
              onClick={handleExportScriptJson}
              className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 p-2 rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Script JSON</span>
            </button>
          </div>
        </div>

        {/* 2. Scene Breakdown & Telemetry */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-amber-400">
              <Table className="w-5 h-5" />
              <h2 className="text-sm font-semibold text-zinc-100">Scene Breakdown Data</h2>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Export structured scene metadata including camera directions, settings, durations, and visual prompts.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800 text-xs">
            <button
              onClick={handleExportScenesCSV}
              className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 p-2 rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Scene Data (CSV)</span>
            </button>

            <button
              onClick={handleExportScenesJson}
              className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 p-2 rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Scenes (JSON)</span>
            </button>
          </div>
        </div>

        {/* 3. Printable Storyboard */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-amber-400">
              <Printer className="w-5 h-5" />
              <h2 className="text-sm font-semibold text-zinc-100">Printable Storyboard (PDF)</h2>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Opens a dedicated, high-contrast printable document layout with all scenes, camera shots, dialogue, and artwork ready to print or save to PDF.
            </p>
          </div>

          <div className="pt-2 border-t border-zinc-800 text-xs">
            <button
              onClick={() => openPrintableStoryboard(project)}
              className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold p-2.5 rounded transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Printable Storyboard</span>
            </button>
          </div>
        </div>

        {/* 4. Complete Project Package */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-amber-400">
              <Package className="w-5 h-5" />
              <h2 className="text-sm font-semibold text-zinc-100">Project Archive & Backup</h2>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Complete JSON archive containing metadata, screenplay, world bible, scenes, prompts, and asset references.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800 text-xs">
            <button
              onClick={handleExportProjectBackup}
              className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 p-2 rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Package (.json)</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 p-2 rounded transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Package</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
