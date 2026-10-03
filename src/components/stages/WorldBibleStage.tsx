import React, { useState } from 'react';
import { Project, WorldBible, Character, Location, Prop } from '../../types';
import { extractWorldBibleApi } from '../../services/api';
import {
  Users,
  MapPin,
  Package,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Check,
  ArrowRight,
  AlertCircle,
  Palette,
} from 'lucide-react';

interface WorldBibleStageProps {
  project: Project;
  onUpdateBible: (bible: WorldBible) => void;
  onProceedToScenes: () => void;
}

export const WorldBibleStage: React.FC<WorldBibleStageProps> = ({
  project,
  onUpdateBible,
  onProceedToScenes,
}) => {
  const [activeTab, setActiveTab] = useState<'characters' | 'locations' | 'props'>('characters');
  const [isExtracting, setIsExtracting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Edit / Add Character Modal
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [isNewChar, setIsNewChar] = useState(false);

  // Edit / Add Location Modal
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isNewLoc, setIsNewLoc] = useState(false);

  // Edit / Add Prop Modal
  const [editingProp, setEditingProp] = useState<Prop | null>(null);
  const [isNewProp, setIsNewProp] = useState(false);

  const bible = project.bible || {
    visualTheme: project.metadata.visualStyle,
    characters: [],
    locations: [],
    props: [],
  };

  const handleExtractFromScript = async () => {
    if (!project.script?.fullScript) {
      setErrorMessage('Please generate or write a screenplay first before extracting the bible.');
      return;
    }

    setIsExtracting(true);
    setErrorMessage(null);

    const res = await extractWorldBibleApi({
      script: project.script.fullScript,
      title: project.metadata.title,
      contentType: project.metadata.contentType,
    });

    setIsExtracting(false);

    if (res.success && res.data) {
      onUpdateBible(res.data);
    } else {
      setErrorMessage(res.error || 'Failed to extract world bible.');
    }
  };

  // Character mutations
  const handleSaveCharacter = (char: Character) => {
    const chars = [...(bible.characters || [])];
    if (isNewChar) {
      chars.push(char);
    } else {
      const idx = chars.findIndex((c) => c.id === char.id);
      if (idx !== -1) chars[idx] = char;
    }
    onUpdateBible({ ...bible, characters: chars });
    setEditingCharacter(null);
  };

  const handleDeleteCharacter = (id: string) => {
    const chars = (bible.characters || []).filter((c) => c.id !== id);
    onUpdateBible({ ...bible, characters: chars });
  };

  // Location mutations
  const handleSaveLocation = (loc: Location) => {
    const locs = [...(bible.locations || [])];
    if (isNewLoc) {
      locs.push(loc);
    } else {
      const idx = locs.findIndex((l) => l.id === loc.id);
      if (idx !== -1) locs[idx] = loc;
    }
    onUpdateBible({ ...bible, locations: locs });
    setEditingLocation(null);
  };

  const handleDeleteLocation = (id: string) => {
    const locs = (bible.locations || []).filter((l) => l.id !== id);
    onUpdateBible({ ...bible, locations: locs });
  };

  // Prop mutations
  const handleSaveProp = (prop: Prop) => {
    const props = [...(bible.props || [])];
    if (isNewProp) {
      props.push(prop);
    } else {
      const idx = props.findIndex((p) => p.id === prop.id);
      if (idx !== -1) props[idx] = prop;
    }
    onUpdateBible({ ...bible, props });
    setEditingProp(null);
  };

  const handleDeleteProp = (id: string) => {
    const props = (bible.props || []).filter((p) => p.id !== id);
    onUpdateBible({ ...bible, props });
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">
            World Bible & Character Consistency
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Canonical character visuals, recurring locations, and props automatically injected into scene prompts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExtractFromScript}
            disabled={isExtracting}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-semibold px-4 py-2 rounded text-xs transition-colors"
          >
            {isExtracting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Extracting Entities...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Extract from Screenplay</span>
              </>
            )}
          </button>

          <button
            onClick={onProceedToScenes}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-3.5 py-2 rounded text-xs transition-colors"
          >
            <span>Next: Scene Breakdown</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-lg p-4 flex items-start gap-3 text-xs text-rose-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-rose-300">Notice: </span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Visual Theme Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <Palette className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <span className="text-zinc-400">Master Visual Style Theme: </span>
            <span className="text-zinc-200 font-medium">{bible.visualTheme || 'Not defined'}</span>
          </div>
        </div>
        <input
          type="text"
          value={bible.visualTheme}
          onChange={(e) => onUpdateBible({ ...bible, visualTheme: e.target.value })}
          placeholder="Update visual theme for prompts..."
          className="bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-200 text-xs w-full sm:w-80 focus:outline-none focus:border-amber-400"
        />
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('characters')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-medium transition-colors ${
            activeTab === 'characters'
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Characters ({bible.characters?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('locations')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-medium transition-colors ${
            activeTab === 'locations'
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Locations ({bible.locations?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('props')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-medium transition-colors ${
            activeTab === 'props'
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Key Props ({bible.props?.length || 0})</span>
        </button>
      </div>

      {/* Tab 1: Characters */}
      {activeTab === 'characters' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Characters maintain visual consistency across all generated storyboard frames.
            </p>
            <button
              onClick={() => {
                setEditingCharacter({
                  id: 'char-' + Date.now(),
                  name: '',
                  role: 'protagonist',
                  description: '',
                  appearance: '',
                  personality: '',
                  clothing: '',
                  visualMarkers: '',
                });
                setIsNewChar(true);
              }}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-3 py-1.5 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Character</span>
            </button>
          </div>

          {bible.characters?.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-lg p-12 text-center text-xs text-zinc-500">
              No characters cataloged yet. Click "Extract from Screenplay" or "Add Character" manually.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bible.characters.map((char) => (
                <div
                  key={char.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-3 relative group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100">{char.name}</h3>
                      <div className="text-[11px] text-zinc-500 capitalize">
                        <span>{char.role}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingCharacter(char);
                          setIsNewChar(false);
                        }}
                        className="text-zinc-400 hover:text-zinc-200 p-1"
                        title="Edit character"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCharacter(char.id)}
                        className="text-zinc-500 hover:text-rose-400 p-1"
                        title="Delete character"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">{char.description}</p>

                  <div className="pt-2 border-t border-zinc-800/80 space-y-1.5 text-xs">
                    <div>
                      <span className="text-zinc-500 font-medium">Appearance: </span>
                      <span className="text-zinc-300">{char.appearance}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 font-medium">Wardrobe: </span>
                      <span className="text-zinc-300">{char.clothing}</span>
                    </div>
                    {char.visualMarkers && (
                      <div>
                        <span className="text-amber-400/80 font-medium">Prompt Markers: </span>
                        <span className="text-zinc-300">{char.visualMarkers}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Locations */}
      {activeTab === 'locations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Recurring locations ensure architectural, environmental, and lighting coherence.
            </p>
            <button
              onClick={() => {
                setEditingLocation({
                  id: 'loc-' + Date.now(),
                  name: '',
                  description: '',
                  environment: '',
                  visualCharacteristics: '',
                  timeAndLighting: '',
                });
                setIsNewLoc(true);
              }}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-3 py-1.5 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Location</span>
            </button>
          </div>

          {bible.locations?.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-lg p-12 text-center text-xs text-zinc-500">
              No locations cataloged yet. Click "Extract from Screenplay" or "Add Location" manually.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bible.locations.map((loc) => (
                <div
                  key={loc.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100">{loc.name}</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">{loc.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingLocation(loc);
                          setIsNewLoc(false);
                        }}
                        className="text-zinc-400 hover:text-zinc-200 p-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(loc.id)}
                        className="text-zinc-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/80 space-y-1.5 text-xs">
                    <div>
                      <span className="text-zinc-500 font-medium">Environment: </span>
                      <span className="text-zinc-300">{loc.environment}</span>
                    </div>
                    {loc.visualCharacteristics && (
                      <div>
                        <span className="text-zinc-500 font-medium">Visual Details: </span>
                        <span className="text-zinc-300">{loc.visualCharacteristics}</span>
                      </div>
                    )}
                    {loc.timeAndLighting && (
                      <div>
                        <span className="text-zinc-500 font-medium">Lighting: </span>
                        <span className="text-zinc-300">{loc.timeAndLighting}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Props */}
      {activeTab === 'props' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Key narrative artifacts, weapons, gadgets, or vehicles.
            </p>
            <button
              onClick={() => {
                setEditingProp({
                  id: 'prop-' + Date.now(),
                  name: '',
                  description: '',
                  visualDetails: '',
                });
                setIsNewProp(true);
              }}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-3 py-1.5 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Prop</span>
            </button>
          </div>

          {bible.props?.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-lg p-12 text-center text-xs text-zinc-500">
              No props recorded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bible.props.map((prop) => (
                <div
                  key={prop.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100">{prop.name}</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">{prop.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingProp(prop);
                          setIsNewProp(false);
                        }}
                        className="text-zinc-400 hover:text-zinc-200 p-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProp(prop.id)}
                        className="text-zinc-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/80 text-xs">
                    <span className="text-zinc-500 font-medium">Visual Details: </span>
                    <span className="text-zinc-300">{prop.visualDetails}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Character Edit Modal */}
      {editingCharacter && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-lg p-6 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">
              {isNewChar ? 'New Character Profile' : 'Edit Character Profile'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={editingCharacter.name}
                  onChange={(e) =>
                    setEditingCharacter({ ...editingCharacter, name: e.target.value })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Role</label>
                <select
                  value={editingCharacter.role}
                  onChange={(e) =>
                    setEditingCharacter({
                      ...editingCharacter,
                      role: e.target.value as any,
                    })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                >
                  <option value="protagonist">Protagonist</option>
                  <option value="antagonist">Antagonist</option>
                  <option value="supporting">Supporting</option>
                  <option value="narrator">Narrator</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Description & Bio</label>
                <textarea
                  value={editingCharacter.description}
                  onChange={(e) =>
                    setEditingCharacter({ ...editingCharacter, description: e.target.value })
                  }
                  rows={2}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  Physical Appearance (Age, Build, Face, Hair)
                </label>
                <input
                  type="text"
                  value={editingCharacter.appearance}
                  onChange={(e) =>
                    setEditingCharacter({ ...editingCharacter, appearance: e.target.value })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Wardrobe & Clothing</label>
                <input
                  type="text"
                  value={editingCharacter.clothing}
                  onChange={(e) =>
                    setEditingCharacter({ ...editingCharacter, clothing: e.target.value })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  Distinct Prompt Markers (Scars, Glasses, Badges, Colors)
                </label>
                <input
                  type="text"
                  value={editingCharacter.visualMarkers}
                  onChange={(e) =>
                    setEditingCharacter({
                      ...editingCharacter,
                      visualMarkers: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingCharacter(null)}
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveCharacter(editingCharacter)}
                className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold rounded text-xs transition-colors"
              >
                Save Character
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Edit Modal */}
      {editingLocation && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-lg p-6 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">
              {isNewLoc ? 'New Location' : 'Edit Location'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={editingLocation.name}
                  onChange={(e) =>
                    setEditingLocation({ ...editingLocation, name: e.target.value })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Environment</label>
                <textarea
                  value={editingLocation.environment}
                  onChange={(e) =>
                    setEditingLocation({ ...editingLocation, environment: e.target.value })
                  }
                  rows={2}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Visual Details</label>
                <input
                  type="text"
                  value={editingLocation.visualCharacteristics}
                  onChange={(e) =>
                    setEditingLocation({
                      ...editingLocation,
                      visualCharacteristics: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Lighting & Ambiance</label>
                <input
                  type="text"
                  value={editingLocation.timeAndLighting}
                  onChange={(e) =>
                    setEditingLocation({
                      ...editingLocation,
                      timeAndLighting: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingLocation(null)}
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveLocation(editingLocation)}
                className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold rounded text-xs transition-colors"
              >
                Save Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prop Edit Modal */}
      {editingProp && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-lg p-6 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">
              {isNewProp ? 'New Prop' : 'Edit Prop'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Prop Name</label>
                <input
                  type="text"
                  value={editingProp.name}
                  onChange={(e) => setEditingProp({ ...editingProp, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Description</label>
                <textarea
                  value={editingProp.description}
                  onChange={(e) =>
                    setEditingProp({ ...editingProp, description: e.target.value })
                  }
                  rows={2}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Visual Details</label>
                <input
                  type="text"
                  value={editingProp.visualDetails}
                  onChange={(e) =>
                    setEditingProp({ ...editingProp, visualDetails: e.target.value })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingProp(null)}
                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveProp(editingProp)}
                className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold rounded text-xs transition-colors"
              >
                Save Prop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
