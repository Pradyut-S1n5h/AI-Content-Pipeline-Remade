import React, { useState, useEffect, useRef } from 'react';
import {
  Project,
  PipelineStage,
  ProjectMetadata,
  ScriptSection,
  WorldBible,
  Scene,
  SceneUpdate,
  ScriptUpdate,
} from './types';
import {
  loadProjectLocal,
  saveProjectLocal,
  listAllProjects,
  deleteProjectLocal,
  createNewBlankProject,
  getActiveProjectId,
  setActiveProjectId,
  saveProjectVideo,
  deleteProjectVideo,
} from './services/storage';
import { getLocalStatus } from './services/api';
import { DEMO_PROJECT_SIGNAL } from './utils/sampleData';
import { appendScriptVersion, restoreScriptVersion } from './utils/scriptHistory';

import { Header } from './components/Header';
import { PipelineNav } from './components/PipelineNav';
import { ProjectModal } from './components/ProjectModal';
import { SettingsModal } from './components/SettingsModal';
import { ProjectOverview } from './components/stages/ProjectOverview';
import { ScriptStage } from './components/stages/ScriptStage';
import { WorldBibleStage } from './components/stages/WorldBibleStage';
import { SceneStage } from './components/stages/SceneStage';
import { StoryboardStage } from './components/stages/StoryboardStage';
import { AudioStage } from './components/stages/AudioStage';
import { VideoStage } from './components/stages/VideoStage';
import { ExportStage } from './components/stages/ExportStage';
import { GenerateStage } from './components/stages/GenerateStage';

export default function App() {
  const [project, setProject] = useState<Project>(DEMO_PROJECT_SIGNAL);

  const [allProjects, setAllProjects] = useState<ProjectMetadata[]>([]);
  const [currentStage, setCurrentStage] = useState<PipelineStage>(() => project.currentStage);
  const [projectReady, setProjectReady] = useState(false);
  const [projectRecoveryFailed, setProjectRecoveryFailed] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'unsaved' | 'failed'>('saved');
  const [saveError, setSaveError] = useState('');
  const [modelsReady, setModelsReady] = useState(0);
  const [modelStatusRefresh, setModelStatusRefresh] = useState(0);

  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    const restoreProjects = async () => {
      try {
        const activeId = getActiveProjectId();
        const restored = activeId ? await loadProjectLocal(activeId) : null;
        if (cancelled) return;
        if (restored) {
          setProject(restored);
          setCurrentStage(restored.currentStage);
        }
        setAllProjects(await listAllProjects());
        if (!cancelled) setProjectReady(true);
      } catch (error) {
        if (!cancelled) {
          setSaveError(error instanceof Error ? error.message : 'Project recovery failed.');
          setSaveStatus('failed');
          setProjectRecoveryFailed(true);
          setProjectReady(true);
        }
      }
    };
    void restoreProjects();

    const refreshModels = async () => {
      const local = await getLocalStatus();
      if (local.success && local.data) {
        setModelsReady(Object.values(local.data.models).filter((model) => model.ready).length);
      }
    };
    void refreshModels();
    return () => { cancelled = true; };
  }, []);

  // Autosave whenever project changes (debounced)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSequenceRef = useRef(0);
  useEffect(() => {
    if (!projectReady || projectRecoveryFailed) return;
    setSaveStatus('unsaved');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saving');
      const sequence = ++saveSequenceRef.current;
      void (async () => {
        try {
          await saveProjectLocal(project);
          const projects = await listAllProjects();
          if (sequence !== saveSequenceRef.current) return;
          setAllProjects(projects);
          setSaveError('');
          setSaveStatus('saved');
        } catch (error) {
          if (sequence !== saveSequenceRef.current) return;
          setSaveError(error instanceof Error ? error.message : 'Project save failed.');
          setSaveStatus('failed');
        }
      })();
    }, 600);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [project, projectReady, projectRecoveryFailed]);

  const handleSaveNow = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const sequence = ++saveSequenceRef.current;
    setSaveStatus('saving');
    try {
      await saveProjectLocal(project);
      const projects = await listAllProjects();
      if (sequence !== saveSequenceRef.current) return;
      setAllProjects(projects);
      setSaveError('');
      setSaveStatus('saved');
    } catch (error) {
      if (sequence !== saveSequenceRef.current) return;
      setSaveError(error instanceof Error ? error.message : 'Project save failed.');
      setSaveStatus('failed');
    }
  };

  const projectRef = useRef(project);
  projectRef.current = project;
  useEffect(() => {
    const saveBeforePageExit = () => {
      void saveProjectLocal(projectRef.current).catch((error: unknown) => {
        console.error('Final project save failed:', error);
      });
    };
    window.addEventListener('pagehide', saveBeforePageExit);
    return () => window.removeEventListener('pagehide', saveBeforePageExit);
  }, []);

  const navigateToStage = (stage: PipelineStage) => {
    setCurrentStage(stage);
    setProject((prev) => ({ ...prev, currentStage: stage }));
  };

  // Stage completion tracker helper
  const markStageCompleted = (stage: PipelineStage) => {
    if (!project.completedStages.includes(stage)) {
      setProject((prev) => ({
        ...prev,
        completedStages: [...prev.completedStages, stage],
      }));
    }
  };

  // Handlers for stage updates
  const handleUpdateScript = (projectId: string, update: ScriptUpdate, label = 'Edit') => {
    setProject((prev) => {
      if (prev.metadata.id !== projectId) return prev;
      const script = typeof update === 'function' ? update(prev.script) : update;
      if (JSON.stringify(script) === JSON.stringify(prev.script)) return prev;
      const history = appendScriptVersion(prev, script, label);
      const completed: PipelineStage[] = prev.completedStages.includes('script')
        ? prev.completedStages
        : [...prev.completedStages, 'script'];
      return {
        ...prev,
        script,
        ...history,
        completedStages: completed,
      };
    });
  };

  const handleRestoreScriptVersion = (projectId: string, index: number) => {
    setProject((prev) => {
      if (prev.metadata.id !== projectId) return prev;
      const version = restoreScriptVersion(prev, index);
      if (!version) return prev;
      return {
        ...prev,
        ...version,
      };
    });
  };

  const handleUpdateBible = (projectId: string, bible: WorldBible) => {
    setProject((prev) => {
      if (prev.metadata.id !== projectId) return prev;
      const completed: PipelineStage[] = prev.completedStages.includes('bible')
        ? prev.completedStages
        : [...prev.completedStages, 'bible'];
      return {
        ...prev,
        bible,
        completedStages: completed,
      };
    });
  };

  const handleUpdateScenes = (projectId: string, update: SceneUpdate) => {
    setProject((prev) => {
      if (prev.metadata.id !== projectId) return prev;
      const scenes = typeof update === 'function' ? update(prev.scenes) : update;
      return {
        ...prev,
        scenes,
      };
    });
  };

  const handleUpdateVideo = async (projectId: string, video: Blob): Promise<string> => {
    const assetId = await saveProjectVideo(projectId, video);
    setProject((prev) => {
      if (prev.metadata.id !== projectId) return prev;
      const completed: PipelineStage[] = prev.completedStages.includes('video')
        ? prev.completedStages
        : [...prev.completedStages, 'video'];
      return {
        ...prev,
        assembledVideoUrl: undefined,
        assembledVideoAssetId: assetId,
        completedStages: completed,
      };
    });
    return assetId;
  };

  // Project switcher
  const projectLoadSequence = useRef(0);
  const handleSelectProject = async (id: string) => {
    const sequence = ++projectLoadSequence.current;
    try {
      const loaded = await loadProjectLocal(id);
      if (sequence !== projectLoadSequence.current) return;
      if (loaded) {
        setProject(loaded);
        setActiveProjectId(id);
        setCurrentStage(loaded.currentStage);
        setProjectRecoveryFailed(false);
        setSaveError('');
        setSaveStatus('saved');
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not load this project.');
      setSaveStatus('failed');
    }
  };

  const handleNewProject = () => {
    setIsCreatingNew(true);
    setIsProjectModalOpen(true);
  };

  const handleSaveProjectMetadata = async (partial: Partial<ProjectMetadata>) => {
    if (isCreatingNew) {
      try {
        const newProj = await createNewBlankProject(partial);
        setProject(newProj);
        setActiveProjectId(newProj.metadata.id);
        setAllProjects(await listAllProjects());
        setCurrentStage(newProj.currentStage);
        setIsCreatingNew(false);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Could not create the project.');
      }
    } else {
      setProject((prev) => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          ...partial,
        },
      }));
    }
  };

  const handleDeleteCurrentProject = async () => {
    if (project.metadata.isDemo) return;
    if (confirm(`Are you sure you want to delete "${project.metadata.title}"?`)) {
      await deleteProjectLocal(project.metadata.id);
      setProject(DEMO_PROJECT_SIGNAL);
      setActiveProjectId(DEMO_PROJECT_SIGNAL.metadata.id);
      setAllProjects(await listAllProjects());
      setCurrentStage(DEMO_PROJECT_SIGNAL.currentStage);
    }
  };

  const handleDuplicateCurrentProject = async () => {
    const duplicate: Project = {
      ...project,
      metadata: {
        ...project.metadata,
        id: 'proj_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
        title: `${project.metadata.title} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDemo: false,
      },
    };
    try {
      await saveProjectLocal(duplicate);
      setProject(duplicate);
      setActiveProjectId(duplicate.metadata.id);
      setAllProjects(await listAllProjects());
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not duplicate the project.');
    }
  };

  const handleImportProject = async (imported: Project): Promise<boolean> => {
    const existing = await loadProjectLocal(imported.metadata.id);
    if (existing && !confirm(`A project named "${existing.metadata.title}" already uses this backup ID. Replace it?`)) {
      return false;
    }
    let importedVideoAssetId: string | undefined;
    try {
      if (imported.assembledVideoDataUrl) {
        const videoBlob = await fetch(imported.assembledVideoDataUrl).then((response) => response.blob());
        importedVideoAssetId = await saveProjectVideo(imported.metadata.id, videoBlob);
      }
      const { assembledVideoDataUrl: _videoDataUrl, ...importedWithoutVideoData } = imported;
      const projectToSave: Project = {
        ...importedWithoutVideoData,
        metadata: { ...imported.metadata, isDemo: false },
        assembledVideoAssetId: importedVideoAssetId,
      };
      await saveProjectLocal(projectToSave);
      setProject(projectToSave);
      setActiveProjectId(imported.metadata.id);
      setAllProjects(await listAllProjects());
      setCurrentStage(imported.currentStage);
      return true;
    } catch (error) {
      if (importedVideoAssetId) await deleteProjectVideo(importedVideoAssetId);
      alert(error instanceof Error ? error.message : 'Could not save the imported project.');
      return false;
    }
  };

  if (!projectReady) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-300">
        Restoring your SceneCraft workspace…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-400 selection:text-zinc-950">
      {/* Primary Top Header */}
      <Header
        project={project}
        allProjects={allProjects}
        onSelectProject={handleSelectProject}
        onNewProject={handleNewProject}
        onOpenProjectModal={() => {
          setIsCreatingNew(false);
          setIsProjectModalOpen(true);
        }}
        saveStatus={saveStatus}
        saveError={saveError}
        onSaveNow={handleSaveNow}
        modelsReady={modelsReady}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      {saveStatus === 'failed' && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-900/70 bg-rose-950/40 px-4 py-2 text-xs text-rose-200 sm:px-6">
          <span>{saveError || 'Project could not be saved.'}</span>
          <button type="button" onClick={handleSaveNow} className="rounded border border-rose-700 px-2.5 py-1 font-medium hover:bg-rose-900/40">
            Retry save
          </button>
        </div>
      )}

      {/* Sequential Pipeline Navigation Bar */}
      <PipelineNav
        currentStage={currentStage}
        completedStages={project.completedStages}
        onSelectStage={navigateToStage}
      />

      {/* Main Workspace Stage Viewport */}
      <main className="flex-1 pb-16">
        {currentStage === 'generate' && (
          <GenerateStage
            onOpenSetup={() => setIsSettingsModalOpen(true)}
            statusRefresh={modelStatusRefresh}
          />
        )}
        {currentStage === 'project' && (
          <ProjectOverview
            project={project}
            onNavigateStage={navigateToStage}
            onEditMetadata={() => {
              setIsCreatingNew(false);
              setIsProjectModalOpen(true);
            }}
            onDeleteProject={handleDeleteCurrentProject}
            onDuplicateProject={handleDuplicateCurrentProject}
          />
        )}

        {currentStage === 'script' && (
          <ScriptStage
            project={project}
            onUpdateScript={(update, label) => handleUpdateScript(project.metadata.id, update, label)}
            onRestoreVersion={(index) => handleRestoreScriptVersion(project.metadata.id, index)}
            onProceedToBible={() => {
              markStageCompleted('script');
              navigateToStage('bible');
            }}
          />
        )}

        {currentStage === 'bible' && (
          <WorldBibleStage
            project={project}
            onUpdateBible={(bible) => handleUpdateBible(project.metadata.id, bible)}
            onProceedToScenes={() => {
              markStageCompleted('bible');
              navigateToStage('scenes');
            }}
          />
        )}

        {currentStage === 'scenes' && (
          <SceneStage
            project={project}
            onUpdateScenes={(update) => handleUpdateScenes(project.metadata.id, update)}
            onProceedToStoryboard={() => {
              markStageCompleted('scenes');
              navigateToStage('storyboard');
            }}
          />
        )}

        {currentStage === 'storyboard' && (
          <StoryboardStage
            project={project}
            onUpdateScenes={(update) => handleUpdateScenes(project.metadata.id, update)}
            onProceedToAudio={() => {
              markStageCompleted('storyboard');
              navigateToStage('audio');
            }}
          />
        )}

        {currentStage === 'audio' && (
          <AudioStage
            project={project}
            onProceedToVideo={() => {
              markStageCompleted('audio');
              navigateToStage('video');
            }}
          />
        )}

        {currentStage === 'video' && (
          <VideoStage
            project={project}
            onUpdateProjectVideo={(video) => handleUpdateVideo(project.metadata.id, video)}
            onProceedToExport={() => {
              markStageCompleted('video');
              navigateToStage('export');
            }}
          />
        )}

        {currentStage === 'export' && (
          <ExportStage
            project={project}
            onImportProject={handleImportProject}
          />
        )}
      </main>

      {/* Project Settings / New Project Modal */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        metadata={
          isCreatingNew
            ? {
                id: '',
                title: '',
                idea: '',
                contentType: 'short_film',
                targetDurationMinutes: 3,
                tone: 'Cinematic, engaging',
                targetAudience: 'General Audience',
                language: 'English',
                visualStyle: 'Cinematic 35mm film, atmospheric lighting',
                aspectRatio: '16:9',
                createdAt: '',
                updatedAt: '',
              }
            : project.metadata
        }
        onSave={handleSaveProjectMetadata}
        isNew={isCreatingNew}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSaved={() => {
          setModelStatusRefresh((version) => version + 1);
          void getLocalStatus().then((local) => {
            if (local.success && local.data) {
              setModelsReady(Object.values(local.data.models).filter((model) => model.ready).length);
            }
          });
        }}
      />
    </div>
  );
}
