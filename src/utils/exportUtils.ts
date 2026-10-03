/**
 * SceneCraft Export Suite Utilities
 * 
 * Provides genuine, standard file exports:
 * - Screenplay (Fountain / Text / Markdown / JSON)
 * - Scene Breakdown (CSV / JSON)
 * - Storyboard (Printable Document view / HTML)
 * - Complete Project Package (JSON)
 */

import { Project, Scene } from '../types';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadText(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

export function exportScriptAsMarkdown(project: Project): string {
  const meta = project.metadata;
  const script = project.script;
  return `# ${meta.title}
*A ${meta.contentType.replace(/_/g, ' ')} screenplay*

**Logline:** ${script.logline || 'N/A'}

**Target Audience:** ${meta.targetAudience}  
**Tone:** ${meta.tone}  
**Estimated Duration:** ${meta.targetDurationMinutes} minutes  

---

## Synopsis
${script.synopsis || 'N/A'}

---

## Screenplay

${script.fullScript || 'No script body generated yet.'}
`;
}

export function exportScriptAsFountain(project: Project): string {
  const meta = project.metadata;
  const script = project.script;
  return `Title: ${meta.title}
Credit: Written with SceneCraft AI Content Pipeline
Draft date: ${new Date().toLocaleDateString()}
Contact: ${meta.targetAudience}

===

/*
LOGLINE:
${script.logline}

SYNOPSIS:
${script.synopsis}
*/

${script.fullScript}
`;
}

export function exportScenesAsCSV(scenes: Scene[]): string {
  const headers = [
    'Scene Number',
    'Title',
    'Setting',
    'Time of Day',
    'Duration (s)',
    'Camera Direction',
    'Mood',
    'Characters',
    'Visual Prompt',
  ];

  const rows = scenes.map((s) => [
    s.sceneNumber,
    `"${(s.title || '').replace(/"/g, '""')}"`,
    `"${(s.setting || '').replace(/"/g, '""')}"`,
    s.timeOfDay,
    s.durationSeconds,
    `"${(s.cameraDirection || '').replace(/"/g, '""')}"`,
    `"${(s.mood || '').replace(/"/g, '""')}"`,
    `"${(s.characters || []).join(', ')}"`,
    `"${(s.imagePrompt || '').replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function openPrintableStoryboard(project: Project) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow popups to open the printable storyboard.');
    return;
  }

  const scenesHtml = project.scenes
    .map(
      (s) => `
    <div class="scene-card">
      <div class="image-box">
        ${
          s.imageUrl
            ? `<img src="${s.imageUrl}" alt="Scene ${s.sceneNumber}" />`
            : `<div class="placeholder">Scene ${s.sceneNumber} [Pending Visual]</div>`
        }
      </div>
      <div class="meta-box">
        <div class="scene-header">
          <span class="scene-num">Scene ${s.sceneNumber}</span>
          <span class="scene-duration">${s.durationSeconds}s · ${s.timeOfDay}</span>
        </div>
        <h3 class="scene-title">${s.title}</h3>
        <p class="scene-camera"><strong>Camera:</strong> ${s.cameraDirection || 'Standard'}</p>
        <p class="scene-desc">${s.description || s.actions || ''}</p>
        ${s.dialogue ? `<blockquote class="scene-dialogue">${s.dialogue.replace(/\n/g, '<br/>')}</blockquote>` : ''}
      </div>
    </div>
  `
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${project.metadata.title} - Storyboard</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .scene-card { break-inside: avoid; page-break-inside: avoid; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 40px;
      color: #18181b;
      background: #fafafa;
    }
    .header {
      border-bottom: 2px solid #e4e4e7;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .title { margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #09090b; }
    .subtitle { margin: 0; color: #71717a; font-size: 14px; }
    .btn-print {
      background: #18181b;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      margin-top: 15px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
    }
    .scene-card {
      background: white;
      border: 1px solid #e4e4e7;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .image-box {
      width: 100%;
      height: 240px;
      background: #f4f4f5;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .image-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .placeholder { color: #a1a1aa; font-weight: 500; font-size: 14px; }
    .meta-box { padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .scene-header { display: flex; justify-content: space-between; font-size: 12px; color: #71717a; }
    .scene-num { font-weight: 600; color: #09090b; }
    .scene-title { margin: 0; font-size: 16px; font-weight: 600; color: #18181b; }
    .scene-camera { margin: 0; font-size: 12px; color: #52525b; }
    .scene-desc { margin: 0; font-size: 13px; color: #3f3f46; line-height: 1.4; }
    .scene-dialogue {
      margin: 4px 0 0 0;
      padding-left: 10px;
      border-left: 2px solid #d4d4d8;
      font-size: 12px;
      color: #52525b;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">${project.metadata.title}</h1>
    <p class="subtitle">Storyboard Breakdown · ${project.scenes.length} Scenes · Total Runtime: ~${project.metadata.targetDurationMinutes} min</p>
    <button class="btn-print no-print" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="grid">
    ${scenesHtml}
  </div>
</body>
</html>
  `;

  win.document.write(html);
  win.document.close();
}
