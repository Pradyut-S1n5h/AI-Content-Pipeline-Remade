/**
 * SceneCraft - Core Data Models & Pipeline Types
 */

export type ContentType =
  | 'short_film'
  | 'youtube_video'
  | 'educational_video'
  | 'advertisement'
  | 'story'
  | 'animation'
  | 'social_media_video';

export type PipelineStage =
  | 'project'
  | 'script'
  | 'bible'
  | 'scenes'
  | 'storyboard'
  | 'audio'
  | 'video'
  | 'export';

export type GenerationStatus = 'idle' | 'generating' | 'completed' | 'failed';

export interface Character {
  id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'narrator';
  description: string;
  appearance: string;
  personality: string;
  clothing: string;
  visualMarkers: string; // e.g. "scar across left eyebrow, glowing neon cyan visor"
}

export interface Location {
  id: string;
  name: string;
  description: string;
  environment: string; // e.g. "Cyberpunk alleyway, rain-slicked asphalt, flickering neon billboards"
  visualCharacteristics: string;
  timeAndLighting: string;
}

export interface Prop {
  id: string;
  name: string;
  description: string;
  visualDetails: string;
}

export interface WorldBible {
  characters: Character[];
  locations: Location[];
  props: Prop[];
  visualTheme: string;
}

export interface Scene {
  id: string;
  sceneNumber: number;
  title: string;
  description: string;
  setting: string;
  timeOfDay: 'day' | 'night' | 'dusk' | 'dawn' | 'golden_hour' | 'interior_lit' | 'dim_ambient';
  characters: string[]; // character names
  actions: string;
  dialogue?: string;
  cameraDirection: string; // e.g. "Extreme close-up on eye", "Wide establishing drone shot"
  mood: string;
  visualStyle: string;
  durationSeconds: number;
  imagePrompt: string;
  videoPrompt?: string;
  imageUrl?: string;
  imageStatus?: GenerationStatus;
  imageError?: string;
  audioUrl?: string;
  audioStatus?: GenerationStatus;
  audioError?: string;
  audioDuration?: number;
}

export interface ScriptSection {
  title: string;
  logline: string;
  synopsis: string;
  fullScript: string;
  targetAudienceNotes?: string;
}

export interface ProjectMetadata {
  id: string;
  title: string;
  idea: string;
  contentType: ContentType;
  targetDurationMinutes: number;
  tone: string;
  targetAudience: string;
  language: string;
  visualStyle: string;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
}

export interface Project {
  metadata: ProjectMetadata;
  script: ScriptSection;
  bible: WorldBible;
  scenes: Scene[];
  currentStage: PipelineStage;
  completedStages: PipelineStage[];
  assembledVideoUrl?: string;
}

export interface ScriptGenerationRequest {
  title: string;
  idea: string;
  contentType: ContentType;
  tone: string;
  targetAudience: string;
  durationMinutes: number;
  language: string;
  visualStyle: string;
}

export interface SectionRegenerationRequest {
  sectionType: 'title' | 'logline' | 'synopsis' | 'fullScript';
  currentScript: ScriptSection;
  projectIdea: string;
  instructions: string;
}

export interface SceneBreakdownRequest {
  script: string;
  title: string;
  contentType: ContentType;
  durationMinutes: number;
  bible: WorldBible;
}

export interface BibleExtractionRequest {
  script: string;
  title: string;
  contentType: ContentType;
}

export interface VisualPromptGenerationRequest {
  scene: Partial<Scene>;
  bible: WorldBible;
  visualStyle: string;
}

export interface ImageGenerationRequest {
  prompt: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  sceneId?: string;
}

export interface AudioTTSRequest {
  text: string;
  voice?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  speakerRole?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  isFallback?: boolean;
}
