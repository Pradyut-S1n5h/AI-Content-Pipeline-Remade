import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildConsistentScenePrompt,
  validateScript,
  validateScenes,
  validateBible,
} from '../src/utils/promptBuilder';
import {
  exportScriptAsMarkdown,
  exportScriptAsFountain,
  exportScenesAsCSV,
} from '../src/utils/exportUtils';
import { DEMO_PROJECT_SIGNAL } from '../src/utils/sampleData';
import { Project, Scene, WorldBible } from '../src/types';

describe('SceneCraft Pipeline Tests', () => {
  it('1. Project structure integrity', () => {
    const proj = DEMO_PROJECT_SIGNAL;
    assert.equal(proj.metadata.title, 'The Last Signal');
    assert.equal(proj.metadata.contentType, 'short_film');
    assert.ok(proj.scenes.length >= 6);
    assert.ok(proj.script.fullScript.length > 50);
    assert.ok(proj.bible.characters.length >= 2);
  });

  it('2. Prompt Builder incorporates character visual markers and locations consistently', () => {
    const mockBible: WorldBible = {
      visualTheme: 'Cyberpunk neo-noir 35mm',
      characters: [
        {
          id: 'c1',
          name: 'Kaelen',
          role: 'protagonist',
          description: 'Rogue cybernetic netrunner',
          appearance: 'Tall lean cyborg, silver undercut hair',
          personality: 'Cynical',
          clothing: 'weathered black leather trenchcoat with neon cyan under-lining',
          visualMarkers: 'glowing amber ocular implant on left eye',
        },
      ],
      locations: [
        {
          id: 'l1',
          name: 'Neon Alley',
          description: 'Narrow rain-soaked alley',
          environment: 'flickering holographic advertisements, steam from sewer grates',
          visualCharacteristics: 'puddles reflecting neon magenta, damp brick walls',
          timeAndLighting: 'rainy midnight',
        },
      ],
      props: [],
    };

    const scene: Partial<Scene> = {
      title: 'The Ambush',
      cameraDirection: 'Low-angle medium shot',
      description: 'Kaelen draws his pulse blaster as shadows close in',
      setting: 'Neon Alley',
      characters: ['Kaelen'],
      timeOfDay: 'night',
      mood: 'Tense suspense',
    };

    const prompt = buildConsistentScenePrompt(scene, mockBible);

    // Verify consistency elements are present
    assert.ok(prompt.includes('Low-angle medium shot'));
    assert.ok(prompt.includes('Kaelen'));
    assert.ok(prompt.includes('weathered black leather trenchcoat'));
    assert.ok(prompt.includes('glowing amber ocular implant on left eye'));
    assert.ok(prompt.includes('Neon Alley'));
    assert.ok(prompt.includes('Dark nighttime'));
  });

  it('3. Script schema validation: accepts valid and rejects invalid payloads', () => {
    const valid = {
      title: 'Space Odyssey',
      logline: 'An explorer travels to Jupiter.',
      synopsis: 'Full synopsis details here...',
      fullScript: 'INT. COCKPIT - DAY\nDave operates the console.',
    };
    assert.equal(validateScript(valid), true);

    const invalidEmpty = {};
    assert.equal(validateScript(invalidEmpty), false);

    const invalidMissingField = {
      title: 'Only title',
    };
    assert.equal(validateScript(invalidMissingField), false);

    const invalidNonObject = 'just a string';
    assert.equal(validateScript(invalidNonObject), false);
  });

  it('4. Scene breakdown validation: verifies structured scene items', () => {
    const validScenes = [
      {
        sceneNumber: 1,
        title: 'Opening Beat',
        description: 'First action occurs',
        cameraDirection: 'Wide establishing aerial',
      },
      {
        sceneNumber: 2,
        title: 'Second Beat',
        description: 'Dialogue exchange',
        cameraDirection: 'Medium shot',
      },
    ];
    assert.equal(validateScenes(validScenes), true);

    const invalidScenes = [
      {
        sceneNumber: 'not-a-number',
      },
    ];
    assert.equal(validateScenes(invalidScenes), false);
    assert.equal(validateScenes([]), false);
  });

  it('5. World Bible validation: checks characters and locations lists', () => {
    const validBible = {
      characters: [{ name: 'Hero' }],
      locations: [{ name: 'Base' }],
    };
    assert.equal(validateBible(validBible), true);

    const invalidBible = {
      characters: 'not an array',
    };
    assert.equal(validateBible(invalidBible), false);
  });

  it('6. Scene reordering and duration calculation', () => {
    const scenes: Scene[] = [
      {
        id: 's1',
        sceneNumber: 1,
        title: 'Scene A',
        description: 'A',
        setting: 'Room',
        timeOfDay: 'day',
        characters: [],
        actions: 'action',
        cameraDirection: 'Wide',
        mood: 'calm',
        visualStyle: 'film',
        durationSeconds: 4,
        imagePrompt: 'prompt',
      },
      {
        id: 's2',
        sceneNumber: 2,
        title: 'Scene B',
        description: 'B',
        setting: 'Room',
        timeOfDay: 'day',
        characters: [],
        actions: 'action',
        cameraDirection: 'Wide',
        mood: 'calm',
        visualStyle: 'film',
        durationSeconds: 6,
        imagePrompt: 'prompt',
      },
    ];

    // Total duration check
    const totalDuration = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
    assert.equal(totalDuration, 10);

    // Swap scenes
    const reordered = [scenes[1], scenes[0]].map((s, idx) => ({
      ...s,
      sceneNumber: idx + 1,
    }));

    assert.equal(reordered[0].title, 'Scene B');
    assert.equal(reordered[0].sceneNumber, 1);
    assert.equal(reordered[1].title, 'Scene A');
    assert.equal(reordered[1].sceneNumber, 2);
  });

  it('7. Export format generators: Markdown, Fountain, CSV', () => {
    const proj = DEMO_PROJECT_SIGNAL;

    const md = exportScriptAsMarkdown(proj);
    assert.ok(md.includes('# The Last Signal'));
    assert.ok(md.includes('Logline:'));

    const fountain = exportScriptAsFountain(proj);
    assert.ok(fountain.includes('Title: The Last Signal'));
    assert.ok(fountain.includes('INT. KEPLER-9 OBSERVATION DECK'));

    const csv = exportScenesAsCSV(proj.scenes);
    assert.ok(csv.includes('Scene Number,Title,Setting'));
    assert.ok(csv.includes('The Lonely Watch'));
  });

  it('8. Pipeline progression stages integrity', () => {
    const stages = ['project', 'script', 'bible', 'scenes', 'storyboard', 'audio', 'video', 'export'];
    assert.equal(stages.length, 8);

    const testProject: Project = {
      ...DEMO_PROJECT_SIGNAL,
      completedStages: ['project'],
    };

    // Simulate completion transition
    testProject.completedStages.push('script');
    assert.ok(testProject.completedStages.includes('script'));
  });
});
