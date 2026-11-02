import {
  Character,
  ContentType,
  Location,
  PipelineStage,
  Project,
  Prop,
  Scene,
  ScriptSection,
  ScriptVersion,
} from '../types';

const BACKUP_FORMAT = 'scenecraft-project';
const BACKUP_VERSION = 1;
const CONTENT_TYPES: ContentType[] = [
  'short_film',
  'youtube_video',
  'educational_video',
  'advertisement',
  'story',
  'animation',
  'social_media_video',
];
const PIPELINE_STAGES: PipelineStage[] = [
  'project',
  'script',
  'bible',
  'scenes',
  'storyboard',
  'audio',
  'video',
  'export',
];
const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3'] as const;
const TIME_OF_DAY = ['day', 'night', 'dusk', 'dawn', 'golden_hour', 'interior_lit', 'dim_ambient'] as const;
const GENERATION_STATUSES = ['idle', 'generating', 'completed', 'failed'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function text(value: unknown): string {
  return isString(value) ? value : '';
}

function normalizeReferenceImages(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 4 ||
      !value.every((image) => typeof image === 'string' &&
        image.length <= 3_000_000 &&
        /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image))) {
    throw new Error('Reference images must be up to four PNG, JPEG, or WebP data images.');
  }
  return value;
}

function isScriptSection(value: unknown): value is ScriptSection {
  return isRecord(value) &&
    isString(value.title) &&
    isString(value.logline) &&
    isString(value.synopsis) &&
    isString(value.fullScript) &&
    (value.targetAudienceNotes === undefined || isString(value.targetAudienceNotes));
}

export function normalizeProject(value: unknown): Project {
  if (!isRecord(value) || !isRecord(value.metadata) || !isRecord(value.script) ||
      !isRecord(value.bible) || !Array.isArray(value.scenes)) {
    throw new Error('This file does not contain a complete SceneCraft project.');
  }

  const metadata = value.metadata;
  const script = value.script;
  const bible = value.bible;
  if (!isString(metadata.id) || !metadata.id || metadata.id.length > 100 ||
      !isString(metadata.title) || !isString(metadata.idea) ||
      !CONTENT_TYPES.includes(metadata.contentType as ContentType) ||
      typeof metadata.targetDurationMinutes !== 'number' ||
      !Number.isFinite(metadata.targetDurationMinutes) || metadata.targetDurationMinutes <= 0 ||
      !isString(metadata.createdAt) || !isString(metadata.updatedAt) ||
      !isString(script.title) || !isString(script.logline) ||
      !isString(script.synopsis) || !isString(script.fullScript) ||
      !isString(bible.visualTheme) || !Array.isArray(bible.characters) ||
      !Array.isArray(bible.locations) || (bible.props !== undefined && !Array.isArray(bible.props))) {
    throw new Error('The project metadata, screenplay, or world bible is invalid.');
  }

  const scenes = value.scenes.map((scene, index): Scene => {
    if (!isRecord(scene) ||
        (scene.id !== undefined && !isString(scene.id)) ||
        !Number.isInteger(scene.sceneNumber) ||
        !isString(scene.title) ||
        !isString(scene.description) ||
        typeof scene.durationSeconds !== 'number' ||
        !Number.isFinite(scene.durationSeconds) ||
        (scene.characters !== undefined &&
          (!Array.isArray(scene.characters) || !scene.characters.every(isString)))) {
      throw new Error('One or more scenes in the project are invalid.');
    }
    return {
      id: isString(scene.id) && scene.id ? scene.id : `scene-${index + 1}`,
      sceneNumber: scene.sceneNumber as number,
      title: scene.title,
      description: scene.description,
      setting: text(scene.setting),
      timeOfDay: TIME_OF_DAY.includes(scene.timeOfDay as (typeof TIME_OF_DAY)[number])
        ? scene.timeOfDay as Scene['timeOfDay']
        : 'day',
      characters: Array.isArray(scene.characters) ? scene.characters : [],
      actions: text(scene.actions),
      ...(isString(scene.dialogue) ? { dialogue: scene.dialogue } : {}),
      cameraDirection: text(scene.cameraDirection),
      mood: text(scene.mood),
      visualStyle: text(scene.visualStyle),
      durationSeconds: scene.durationSeconds,
      imagePrompt: text(scene.imagePrompt),
      ...(isString(scene.videoPrompt) ? { videoPrompt: scene.videoPrompt } : {}),
      ...(isString(scene.imageUrl) ? { imageUrl: scene.imageUrl } : {}),
      ...(GENERATION_STATUSES.includes(scene.imageStatus as (typeof GENERATION_STATUSES)[number])
        ? { imageStatus: scene.imageStatus as Scene['imageStatus'] }
        : {}),
      ...(isString(scene.imageError) ? { imageError: scene.imageError } : {}),
      ...(isString(scene.audioUrl) ? { audioUrl: scene.audioUrl } : {}),
      ...(GENERATION_STATUSES.includes(scene.audioStatus as (typeof GENERATION_STATUSES)[number])
        ? { audioStatus: scene.audioStatus as Scene['audioStatus'] }
        : {}),
      ...(isString(scene.audioError) ? { audioError: scene.audioError } : {}),
      ...(typeof scene.audioDuration === 'number' && Number.isFinite(scene.audioDuration)
        ? { audioDuration: scene.audioDuration }
        : {}),
    };
  });

  const characters: Character[] = bible.characters.map((character, index) => {
    if (!isRecord(character) || !isString(character.name) || !character.name.trim()) {
      throw new Error('One or more character profiles in the project are invalid.');
    }
    const roles = ['protagonist', 'antagonist', 'supporting', 'narrator'] as const;
    return {
      id: isString(character.id) && character.id ? character.id : `character-${index + 1}`,
      name: character.name,
      role: roles.includes(character.role as (typeof roles)[number])
        ? character.role as Character['role']
        : 'supporting',
      description: text(character.description),
      appearance: text(character.appearance),
      personality: text(character.personality),
      clothing: text(character.clothing),
      visualMarkers: text(character.visualMarkers),
      ...(normalizeReferenceImages(character.referenceImages)
        ? { referenceImages: normalizeReferenceImages(character.referenceImages) }
        : {}),
    };
  });
  const locations: Location[] = bible.locations.map((location, index) => {
    if (!isRecord(location) || !isString(location.name) || !location.name.trim()) {
      throw new Error('One or more locations in the project are invalid.');
    }
    return {
      id: isString(location.id) && location.id ? location.id : `location-${index + 1}`,
      name: location.name,
      description: text(location.description),
      environment: text(location.environment),
      visualCharacteristics: text(location.visualCharacteristics),
      timeAndLighting: text(location.timeAndLighting),
      ...(normalizeReferenceImages(location.referenceImages)
        ? { referenceImages: normalizeReferenceImages(location.referenceImages) }
        : {}),
    };
  });
  const props: Prop[] = (Array.isArray(bible.props) ? bible.props : []).map((prop, index) => {
    if (!isRecord(prop) || !isString(prop.name) || !prop.name.trim()) {
      throw new Error('One or more props in the project are invalid.');
    }
    return {
      id: isString(prop.id) && prop.id ? prop.id : `prop-${index + 1}`,
      name: prop.name,
      description: text(prop.description),
      visualDetails: text(prop.visualDetails),
    };
  });

  if (!Array.isArray(scenes)) {
    throw new Error('One or more scenes in the project are invalid.');
  }

  const aspectRatio = ASPECT_RATIOS.includes(metadata.aspectRatio as (typeof ASPECT_RATIOS)[number])
    ? metadata.aspectRatio as Project['metadata']['aspectRatio']
    : '16:9';
  const currentStage = PIPELINE_STAGES.includes(value.currentStage as PipelineStage)
    ? value.currentStage as PipelineStage
    : 'project';
  const completedStages = Array.isArray(value.completedStages)
    ? value.completedStages.filter((stage): stage is PipelineStage =>
      PIPELINE_STAGES.includes(stage as PipelineStage))
    : ['project' as PipelineStage];
  const normalizedScript: ScriptSection = {
    title: script.title,
    logline: script.logline,
    synopsis: script.synopsis,
    fullScript: script.fullScript,
    ...(isString(script.targetAudienceNotes) ? { targetAudienceNotes: script.targetAudienceNotes } : {}),
  };
  const rawHistory = Array.isArray(value.scriptHistory) ? value.scriptHistory : [];
  const historyOffset = Math.max(0, rawHistory.length - 50);
  const history: ScriptVersion[] = rawHistory
    .slice(-50).flatMap((version): ScriptVersion[] => {
      if (!isRecord(version) || !isScriptSection(version.script) ||
          !isString(version.savedAt) || !isString(version.label)) return [];
      return [{
        script: {
          title: version.script.title,
          logline: version.script.logline,
          synopsis: version.script.synopsis,
          fullScript: version.script.fullScript,
          ...(isString(version.script.targetAudienceNotes)
            ? { targetAudienceNotes: version.script.targetAudienceNotes }
            : {}),
        },
        savedAt: version.savedAt,
        label: version.label.slice(0, 100),
      }];
    });
  let scriptHistoryIndex = typeof value.scriptHistoryIndex === 'number' &&
    Number.isInteger(value.scriptHistoryIndex)
    ? Math.max(0, Math.min(value.scriptHistoryIndex - historyOffset, history.length - 1))
    : history.length - 1;
  if (history.length === 0) {
    history.push({ script: normalizedScript, savedAt: metadata.updatedAt, label: 'Current draft' });
    scriptHistoryIndex = 0;
  } else if (JSON.stringify(history[scriptHistoryIndex]?.script) !== JSON.stringify(normalizedScript)) {
    const matchingVersion = history.findIndex((version) =>
      JSON.stringify(version.script) === JSON.stringify(normalizedScript));
    if (matchingVersion >= 0) {
      scriptHistoryIndex = matchingVersion;
    } else {
      history.push({ script: normalizedScript, savedAt: metadata.updatedAt, label: 'Current draft' });
      if (history.length > 50) history.shift();
      scriptHistoryIndex = history.length - 1;
    }
  }
  const scriptHistory = history;

  return {
    metadata: {
      id: metadata.id,
      title: metadata.title,
      idea: metadata.idea,
      contentType: metadata.contentType as ContentType,
      targetDurationMinutes: metadata.targetDurationMinutes,
      tone: isString(metadata.tone) ? metadata.tone : '',
      targetAudience: isString(metadata.targetAudience) ? metadata.targetAudience : '',
      language: isString(metadata.language) ? metadata.language : 'English',
      visualStyle: isString(metadata.visualStyle) ? metadata.visualStyle : '',
      aspectRatio,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      ...(typeof metadata.isDemo === 'boolean' ? { isDemo: metadata.isDemo } : {}),
    },
    script: normalizedScript,
    bible: {
      visualTheme: bible.visualTheme,
      characters,
      locations,
      props,
    },
    scenes,
    scriptHistory,
    scriptHistoryIndex,
    currentStage,
    completedStages,
    ...(isString(value.assembledVideoUrl) && !value.assembledVideoUrl.startsWith('blob:')
      ? { assembledVideoUrl: value.assembledVideoUrl }
      : {}),
    ...(isString(value.assembledVideoAssetId) ? { assembledVideoAssetId: value.assembledVideoAssetId } : {}),
    ...(isString(value.assembledVideoDataUrl) &&
      /^data:video\/(?:webm|mp4);base64,[A-Za-z0-9+/]+={0,2}$/.test(value.assembledVideoDataUrl)
      ? { assembledVideoDataUrl: value.assembledVideoDataUrl }
      : {}),
  };
}

function encodeBytesAsBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length))));
  }
  return btoa(chunks.join(''));
}

export async function serializeProjectBackup(project: Project, videoAsset?: Blob | null): Promise<string> {
  let projectForBackup = project;
  if (videoAsset) {
    const bytes = encodeBytesAsBase64(new Uint8Array(await videoAsset.arrayBuffer()));
    const mimeType = videoAsset.type.split(';')[0];
    projectForBackup = {
      ...project,
      assembledVideoDataUrl: `data:${mimeType};base64,${bytes}`,
    };
  } else if (project.assembledVideoAssetId) {
    throw new Error('The saved video asset could not be loaded. Retry the export or download the video separately.');
  }
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    project: normalizeProject(projectForBackup),
  }, null, 2);
}

export function parseProjectBackup(raw: string): Project {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (isRecord(parsed) && parsed.format !== undefined) {
    if (parsed.format !== BACKUP_FORMAT) {
      throw new Error('This file is not a SceneCraft project backup.');
    }
    if (parsed.version !== BACKUP_VERSION) {
      throw new Error(`This project backup version is not supported (version ${String(parsed.version)}).`);
    }
    return normalizeProject(parsed.project);
  }

  // Previous SceneCraft backups stored the project object directly.
  return normalizeProject(parsed);
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}
