import React, { useState, useEffect, useRef } from 'react';
import {
  Project,
  PipelineStage,
  ProjectMetadata,
  ScriptSection,
  WorldBible,
  Scene,
} from './types';
import {
  loadProjectLocal,
  saveProjectLocal,
  listAllProjects,
  deleteProjectLocal,
  createNewBlankProject,
  getActiveProjectId,
  setActiveProjectId,
} from './services/storage';
import { checkServerHealth } from './services/api';
import { DEMO_PROJECT_SIGNAL } from './utils/sampleData';

import { Header } from './components/Header';
import { PipelineNav } from './components/PipelineNav';
import { ProjectModal } from './components/ProjectModal';
import { ProjectOverview } from './components/stages/ProjectOverview';
import { ScriptStage } from './components/stages/ScriptStage';
import { WorldBibleStage } from './components/stages/WorldBibleStage';
import { SceneStage } from './components/stages/SceneStage';
import { StoryboardStage } from './components/stages/StoryboardStage';
import { AudioStage } from './components/stages/AudioStage';
import { VideoStage } from './components/stages/VideoStage';
import { ExportStage } from './components/stages/ExportStage';

export default function App() {
  const [project, setProject] = useState<Project>(() => {
    const activeId = getActiveProjectId();
    if (activeId) {
      const stored = loadProjectLocal(activeId);
      if (stored) return stored;
    }
    return DEMO_PROJECT_SIGNAL;
  });

  const [allProjects, setAllProjects] = useState<ProjectMetadata[]>([]);
  const [currentStage, setCurrentStage] = useState<PipelineStage>('project');
  const [isSaving, setIsSaving] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);

  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Initial load
  useEffect(() => {
    // 1. Sync project list
    const list = listAllProjects();
    setAllProjects(list);

    // 2. Health check
    checkServerHealth().then((res) => {
      setHasGeminiKey(res.hasGeminiKey);
    });
  }, []);

  // Autosave whenever project changes (debounced)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    setIsSaving(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      saveProjectLocal(project);
      setAllProjects(listAllProjects());
      setIsSaving(false);
    }, 600);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [project]);

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
  const handleUpdateScript = (script: ScriptSection) => {
    setProject((prev) => {
      const completed: PipelineStage[] = prev.completedStages.includes('script')
        ? prev.completedStages
        : [...prev.completedStages, 'script'];
      return {
        ...prev,
        script,
        completedStages: completed,
      };
    });
  };

  const handleUpdateBible = (bible: WorldBible) => {
    setProject((prev) => {
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

  const handleUpdateScenes = (scenes: Scene[]) => {
    setProject((prev) => {
      const completed: PipelineStage[] = prev.completedStages.includes('scenes')
        ? prev.completedStages
        : [...prev.completedStages, 'scenes'];
      return {
        ...prev,
        scenes,
        completedStages: completed,
      };
    });
  };

  const handleUpdateVideo = (videoUrl: string) => {
    setProject((prev) => {
      const completed: PipelineStage[] = prev.completedStages.includes('video')
        ? prev.completedStages
        : [...prev.completedStages, 'video'];
      return {
        ...prev,
        assembledVideoUrl: videoUrl,
        completedStages: completed,
      };
    });
  };

  // Project switcher
  const handleSelectProject = (id: string) => {
    const loaded = loadProjectLocal(id);
    if (loaded) {
      setProject(loaded);
      setActiveProjectId(id);
      setCurrentStage('project');
    }
  };

  const handleNewProject = () => {
    setIsCreatingNew(true);
    setIsProjectModalOpen(true);
  };

  const handleSaveProjectMetadata = (partial: Partial<ProjectMetadata>) => {
    if (isCreatingNew) {
      const newProj = createNewBlankProject(partial);
      setProject(newProj);
      setActiveProjectId(newProj.metadata.id);
      setAllProjects(listAllProjects());
      setCurrentStage('project');
      setIsCreatingNew(false);
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

  const handleDeleteCurrentProject = () => {
    if (project.metadata.isDemo) return;
    if (confirm(`Are you sure you want to delete "${project.metadata.title}"?`)) {
      deleteProjectLocal(project.metadata.id);
      setProject(DEMO_PROJECT_SIGNAL);
      setActiveProjectId(DEMO_PROJECT_SIGNAL.metadata.id);
      setAllProjects(listAllProjects());
      setCurrentStage('project');
    }
  };

  const handleDuplicateCurrentProject = () => {
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
    saveProjectLocal(duplicate);
    setProject(duplicate);
    setActiveProjectId(duplicate.metadata.id);
    setAllProjects(listAllProjects());
  };

  const handleImportProject = (imported: Project) => {
    saveProjectLocal(imported);
    setProject(imported);
    setActiveProjectId(imported.metadata.id);
    setAllProjects(listAllProjects());
    setCurrentStage('project');
  };

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
        isSaving={isSaving}
        hasGeminiKey={hasGeminiKey}
      />

      {/* Sequential Pipeline Navigation Bar */}
      <PipelineNav
        currentStage={currentStage}
        completedStages={project.completedStages}
        onSelectStage={(stage) => setCurrentStage(stage)}
      />

      {/* Main Workspace Stage Viewport */}
      <main className="flex-1 pb-16">
        {currentStage === 'project' && (
          <ProjectOverview
            project={project}
            onNavigateStage={(stage) => setCurrentStage(stage)}
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
            onUpdateScript={handleUpdateScript}
            onProceedToBible={() => {
              markStageCompleted('script');
              setCurrentStage('bible');
            }}
          />
        )}

        {currentStage === 'bible' && (
          <WorldBibleStage
            project={project}
            onUpdateBible={handleUpdateBible}
            onProceedToScenes={() => {
              markStageCompleted('bible');
              setCurrentStage('scenes');
            }}
          />
        )}

        {currentStage === 'scenes' && (
          <SceneStage
            project={project}
            onUpdateScenes={handleUpdateScenes}
            onProceedToStoryboard={() => {
              markStageCompleted('scenes');
              setCurrentStage('storyboard');
            }}
          />
        )}

        {currentStage === 'storyboard' && (
          <StoryboardStage
            project={project}
            onUpdateScenes={handleUpdateScenes}
            onProceedToAudio={() => {
              markStageCompleted('storyboard');
              setCurrentStage('audio');
            }}
            hasGeminiKey={hasGeminiKey}
          />
        )}

        {currentStage === 'audio' && (
          <AudioStage
            project={project}
            onUpdateScenes={handleUpdateScenes}
            onProceedToVideo={() => {
              markStageCompleted('audio');
              setCurrentStage('video');
            }}
            hasGeminiKey={hasGeminiKey}
          />
        )}

        {currentStage === 'video' && (
          <VideoStage
            project={project}
            onUpdateProjectVideo={handleUpdateVideo}
            onProceedToExport={() => {
              markStageCompleted('video');
              setCurrentStage('export');
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
    </div>
  );
}
