/**
 * SceneCraft Persistence Layer
 * 
 * Manages project persistence via local storage with automatic state restoration,
 * backup export/import, and sync capability with the server workspace.
 */

import { Project, ProjectMetadata } from '../types';
import { DEMO_PROJECT_SIGNAL } from '../utils/sampleData';

const STORAGE_KEY_PREFIX = 'scenecraft_proj_';
const RECENT_LIST_KEY = 'scenecraft_recent_ids';
const ACTIVE_PROJECT_KEY = 'scenecraft_active_id';

export function getAllProjectIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveProjectLocal(project: Project): void {
  try {
    const updated = {
      ...project,
      metadata: {
        ...project.metadata,
        updatedAt: new Date().toISOString(),
      },
    };
    localStorage.setItem(STORAGE_KEY_PREFIX + project.metadata.id, JSON.stringify(updated));

    const list = getAllProjectIds().filter((id) => id !== project.metadata.id);
    list.unshift(project.metadata.id);
    localStorage.setItem(RECENT_LIST_KEY, JSON.stringify(list));
    localStorage.setItem(ACTIVE_PROJECT_KEY, project.metadata.id);
  } catch (err) {
    console.error('Failed to save project locally:', err);
  }
}

export function loadProjectLocal(id: string): Project | null {
  try {
    if (id === DEMO_PROJECT_SIGNAL.metadata.id) {
      const stored = localStorage.getItem(STORAGE_KEY_PREFIX + id);
      return stored ? JSON.parse(stored) : DEMO_PROJECT_SIGNAL;
    }
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function listAllProjects(): ProjectMetadata[] {
  const ids = getAllProjectIds();
  const projects: ProjectMetadata[] = [];

  // Always include Demo project if not present
  if (!ids.includes(DEMO_PROJECT_SIGNAL.metadata.id)) {
    projects.push(DEMO_PROJECT_SIGNAL.metadata);
  }

  for (const id of ids) {
    const proj = loadProjectLocal(id);
    if (proj && proj.metadata) {
      projects.push(proj.metadata);
    }
  }

  return projects;
}

export function deleteProjectLocal(id: string): void {
  try {
    localStorage.removeItem(STORAGE_KEY_PREFIX + id);
    const list = getAllProjectIds().filter((item) => item !== id);
    localStorage.setItem(RECENT_LIST_KEY, JSON.stringify(list));
    if (localStorage.getItem(ACTIVE_PROJECT_KEY) === id) {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  } catch (err) {
    console.error('Failed to delete project locally:', err);
  }
}

export function getActiveProjectId(): string | null {
  return localStorage.getItem(ACTIVE_PROJECT_KEY);
}

export function setActiveProjectId(id: string): void {
  localStorage.setItem(ACTIVE_PROJECT_KEY, id);
}

export function createNewBlankProject(partial?: Partial<ProjectMetadata>): Project {
  const now = new Date().toISOString();
  const id = 'proj_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  
  const metadata: ProjectMetadata = {
    id,
    title: partial?.title || 'Untitled Project',
    idea: partial?.idea || '',
    contentType: partial?.contentType || 'short_film',
    targetDurationMinutes: partial?.targetDurationMinutes || 3,
    tone: partial?.tone || 'Cinematic, engaging, character-driven',
    targetAudience: partial?.targetAudience || 'General Audience',
    language: partial?.language || 'English',
    visualStyle: partial?.visualStyle || 'Cinematic 35mm film, atmospheric lighting, rich textures',
    aspectRatio: partial?.aspectRatio || '16:9',
    createdAt: now,
    updatedAt: now,
    isDemo: false,
  };

  const project: Project = {
    metadata,
    script: {
      title: metadata.title,
      logline: '',
      synopsis: '',
      fullScript: '',
    },
    bible: {
      visualTheme: metadata.visualStyle,
      characters: [],
      locations: [],
      props: [],
    },
    scenes: [],
    currentStage: 'project',
    completedStages: ['project'],
  };

  saveProjectLocal(project);
  return project;
}
