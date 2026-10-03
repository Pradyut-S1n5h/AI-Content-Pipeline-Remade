/**
 * SceneCraft Prompt Builder & Consistency Engine
 * 
 * Formulates detailed image prompts by weaving together:
 * - Scene camera direction and framing
 * - Environment details from the location bible
 * - Specific character visual markers and clothing from the character bible
 * - Key props in the scene
 * - Lighting, time of day, and overall artistic visual style
 */

import { Scene, WorldBible, Character, Location } from '../types';

export function buildConsistentScenePrompt(
  scene: Partial<Scene>,
  bible: WorldBible,
  fallbackStyle: string = 'Cinematic film shot, 35mm lens, photorealistic, atmospheric lighting'
): string {
  const parts: string[] = [];

  // 1. Camera Framing and Subject
  if (scene.cameraDirection) {
    parts.push(scene.cameraDirection);
  }

  // 2. Scene Action / Core Description
  if (scene.description) {
    parts.push(scene.description);
  } else if (scene.actions) {
    parts.push(scene.actions);
  }

  // 3. Characters involved with their specific visual characteristics & attire
  if (scene.characters && scene.characters.length > 0 && bible.characters) {
    const charDetails: string[] = [];
    scene.characters.forEach((charName) => {
      const match = bible.characters.find(
        (c) => c.name.toLowerCase() === charName.toLowerCase() ||
               charName.toLowerCase().includes(c.name.toLowerCase())
      );
      if (match) {
        let desc = `${match.name} (${match.appearance}`;
        if (match.clothing) desc += `, wearing ${match.clothing}`;
        if (match.visualMarkers) desc += `, distinct feature: ${match.visualMarkers}`;
        desc += `)`;
        charDetails.push(desc);
      }
    });

    if (charDetails.length > 0) {
      parts.push(`Featuring: ${charDetails.join('; ')}`);
    }
  }

  // 4. Location & Environment
  if (scene.setting) {
    const matchLoc = bible.locations?.find(
      (l) => l.name.toLowerCase() === scene.setting?.toLowerCase() ||
             scene.setting?.toLowerCase().includes(l.name.toLowerCase())
    );
    if (matchLoc) {
      let locDesc = `Setting: ${matchLoc.name} - ${matchLoc.environment}`;
      if (matchLoc.visualCharacteristics) {
        locDesc += `, ${matchLoc.visualCharacteristics}`;
      }
      parts.push(locDesc);
    } else {
      parts.push(`Setting: ${scene.setting}`);
    }
  }

  // 5. Lighting & Time of Day
  if (scene.timeOfDay) {
    const timeMap: Record<string, string> = {
      day: 'Bright daylight with natural shadows',
      night: 'Dark nighttime, deep contrast, volumetric shadows',
      dusk: 'Dusk twilight, deep blue and orange sky gradient',
      dawn: 'Early dawn, soft misty morning light',
      golden_hour: 'Warm golden hour sunlight, rim lighting, lens flare',
      interior_lit: 'Cinematic interior lighting with key and fill lights',
      dim_ambient: 'Dim ambient moody lighting, subtle specular highlights',
    };
    parts.push(`Lighting: ${timeMap[scene.timeOfDay] || scene.timeOfDay}`);
  }

  // 6. Mood
  if (scene.mood) {
    parts.push(`Atmosphere: ${scene.mood}`);
  }

  // 7. Visual Style & Artistic Theme
  const visualTheme = scene.visualStyle || bible.visualTheme || fallbackStyle;
  parts.push(`Style: ${visualTheme}, highly detailed, 8k resolution look, masterful composition`);

  return parts.filter(Boolean).join('. ');
}

/**
 * Validates a generated script structure
 */
export function validateScript(data: any): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.title === 'string' &&
    typeof data.logline === 'string' &&
    typeof data.synopsis === 'string' &&
    typeof data.fullScript === 'string'
  );
}

/**
 * Validates scene breakdown array
 */
export function validateScenes(data: any): boolean {
  if (!Array.isArray(data) || data.length === 0) return false;
  return data.every(
    (s) =>
      typeof s.sceneNumber === 'number' &&
      typeof s.title === 'string' &&
      typeof s.description === 'string' &&
      typeof s.cameraDirection === 'string'
  );
}

/**
 * Validates world bible
 */
export function validateBible(data: any): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray(data.characters) &&
    Array.isArray(data.locations)
  );
}
