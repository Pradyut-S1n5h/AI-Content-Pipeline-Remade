/**
 * SceneCraft - Sample & Demo Project Data
 * 
 * Provides a ready-to-explore project for reviewers, demonstrating:
 * - Structured screenplay and synopsis
 * - World Bible (characters, locations, props)
 * - Complete scene breakdown with visual prompts & camera directions
 * - Real playable animatic sequence
 */

import { Project } from '../types';

export const DEMO_PROJECT_SIGNAL: Project = {
  metadata: {
    id: 'demo-last-signal',
    title: 'The Last Signal',
    idea: 'A solitary deep-space comms technician on outpost station Kepler-9 intercepts a mysterious audio broadcast from an uncharted coordinate in the Oort cloud, forcing an agonizing decision.',
    contentType: 'short_film',
    targetDurationMinutes: 3,
    tone: 'Tense, atmospheric sci-fi thriller with emotional gravity',
    targetAudience: 'Sci-fi enthusiasts, film festival audience, cinematic narrative lovers',
    language: 'English',
    visualStyle: 'Cinematic anamorphic 35mm, grounded sci-fi, warm tungsten against deep cold space obsidian, high contrast',
    aspectRatio: '16:9',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDemo: true,
  },
  currentStage: 'storyboard',
  completedStages: ['project', 'script', 'bible', 'scenes', 'storyboard'],
  script: {
    title: 'The Last Signal',
    logline: 'When an isolated deep-space radio technician intercepts an impossible analog frequency from inside the Oort Cloud, she must choose between station protocol and answering humanity’s first true extraterrestrial response.',
    synopsis: 'On the rim of known solar territory, Station Kepler-9 operates in perpetual quiet. Technician Maya Lin spends months scanning dead electromagnetic channels. On day 418 of her solitary tour, the sub-space beacon detects an audio carrier wave containing an old Voyager radio snippet overlaid with unfamiliar algorithmic pulses. Protocol dictates purging unverified beacons, but as the signal degrades, Maya realizes it is not an anomaly—it is a conscious reply directed at her.',
    targetAudienceNotes: 'Focuses on psychological isolation, tangible analog-meets-retro-futurism technology, and cosmic suspense.',
    fullScript: `INT. KEPLER-9 OBSERVATION DECK - NIGHT

A vast curved bay window looks out into a sea of pitch black dusted with cold starfields. Amber LED arrays hum along rack-mounted receiver consoles.

MAYA LIN (30s), wearing an oil-stained gray flight suit with Kepler-9 shoulder patch, taps the frequency sweep dial with calloused fingers. A thermos of cold black tea sits on the counter.

A low oscillating pulse breaks through the white noise. 

MAYA
(whispering to herself)
Static harmonic... wait.

She leans into the audio monitor, adjusting the gain slider. A metallic rhythm clicks through the headphones: three beats, a pause, then two faint analog chimes.

MAYA (CONT'D)
Receiver seven, identify carrier.

COMPUTER (V.O.)
Carrier unlisted. Vector origin: Oort Sector Delta-4. Distance: forty-two astronomical units.

INT. COMMUNICATIONS ARRAY CORRIDOR - CONTINUOUS

Maya jogs down the narrow pressurized gangway, magnetic boots thudding against grated metal decking. Warning conduits pulse a quiet cyan standby light.

She reaches the primary telemetry console. The spectrometer needle oscillates violently, tracing an impossible harmonic curve.

MAYA
Confirm signal degradation rate.

COMPUTER (V.O.)
Signal decay estimated at ninety seconds until dissipation. Automated quarantine protocol initiated. Purge in T-minus sixty.

Maya's hand hovers over the manual override key. Protocol means safety. But this sound has waited a thousand years.

MAYA
Cancel quarantine. Route directly to my personal log.

She slams down the override switch. The speakers flood with a crystal-clear synthetic tone that resonates through the entire station hull.

EXT. KEPLER-9 OUTPOST - CONTINUOUS

The solitary outpost hangs silent in the infinite darkness, solar sails outstretched like silver wings. Below the station, a faint ripple of blue starlight refracts across the icy void.`,
  },
  bible: {
    visualTheme: 'Cinematic 35mm sci-fi, tactile analog instrumentation, amber warning lights, cold deep space backdrop',
    characters: [
      {
        id: 'char-1',
        name: 'Maya Lin',
        role: 'protagonist',
        description: 'Deep-space comms specialist stationed alone on Kepler-9. Methodical, observant, weary but relentlessly curious.',
        appearance: 'East Asian woman in her mid-30s, sharp watchful dark eyes, hair tied back in a utilitarian knot, slight smudge of graphite on her cheek.',
        personality: 'Quiet, intensely focused, skeptical of rigid bureaucracy, deeply empathetic to loneliness.',
        clothing: 'Utility charcoal-gray flight technician suit with thermal padded vest and brass Kepler-9 mission insignia on right sleeve.',
        visualMarkers: 'Brass Kepler-9 mission patch, tactile fingerless radio-technician gloves, audio headset hung around neck.',
      },
      {
        id: 'char-2',
        name: 'A.R.I.A. (Station AI)',
        role: 'supporting',
        description: 'Kepler-9 automated governance system. Monotone, calm, strictly bound by telemetry security regulations.',
        appearance: 'Non-human voice interface represented by a vertical column of amber LED VU-meters and glowing optical lens on consoles.',
        personality: 'Objective, rule-bound, unhurried, devoid of malice but inflexible.',
        clothing: 'N/A',
        visualMarkers: 'Glowing amber vertical LED bar with rhythmic pulsing luminescence.',
      },
    ],
    locations: [
      {
        id: 'loc-1',
        name: 'Kepler-9 Observation Bay',
        description: 'Primary command watch with a massive panoramic viewport looking out into deep space.',
        environment: 'Tactile brass dials, CRT vector scopes, amber backlit buttons, cold metallic interior contrasting with warm status displays.',
        visualCharacteristics: 'Curved reinforced glass with ice crystals along edges, dust motes dancing in warm console lighting.',
        timeAndLighting: 'Dim interior lit by amber indicators; outside is cold obsidian space with distant stellar clouds.',
      },
      {
        id: 'loc-2',
        name: 'Telemetry Corridor',
        description: 'Narrow pressurized utility gangway connecting the hub to the antenna arrays.',
        environment: 'Exposed conduits, hydraulic dampers, diamond-plate steel flooring, emergency bulkheads.',
        visualCharacteristics: 'Cyan standby strips on baseboards, vapor venting gently from ceiling valves.',
        timeAndLighting: 'Cool cyan rim-lit corridor with intermittent flickering warning amber lamps.',
      },
      {
        id: 'loc-3',
        name: 'Deep Space Kepler Outpost (Exterior)',
        description: 'Exterior view of the orbital listening station.',
        environment: 'Vacuum of space, orbital antenna dish, solar panel arrays, rotating habitation ring.',
        visualCharacteristics: 'Industrial modular habitat modules, cold specular highlights off solar foil.',
        timeAndLighting: 'Brilliant rim lighting from distant dying star, stark shadows in deep vacuum.',
      },
    ],
    props: [
      {
        id: 'prop-1',
        name: 'Analog Audio Monitor & Sweep Dial',
        description: 'Heavy brushed-aluminum frequency tuning dial with tactile click detents and analog needle meter.',
        visualDetails: 'Etched kilohertz scales, knurled metal grip, amber backlighting behind needle dial.',
      },
      {
        id: 'prop-2',
        name: 'Manual Override Lever',
        description: 'Safety-gated emergency toggle switch with yellow-and-black hazard chevron stripes.',
        visualDetails: 'Heavy spring-loaded mechanical switch, red LED status eye next to locking pin.',
      },
    ],
  },
  scenes: [
    {
      id: 'scene-1',
      sceneNumber: 1,
      title: 'The Lonely Watch',
      description: 'Maya sits at the central console of the Kepler-9 observation deck, listening into the vast static of deep space.',
      setting: 'Kepler-9 Observation Bay',
      timeOfDay: 'dim_ambient',
      characters: ['Maya Lin'],
      actions: 'Maya tunes an analog radio sweep dial while watching the infinite starfield through the panoramic glass.',
      dialogue: 'MAYA: Static harmonic... wait.',
      cameraDirection: 'Wide establishing shot slowly pushing in on Maya seated before the massive starfield viewport',
      mood: 'Melancholic, quiet, contemplative',
      visualStyle: 'Cinematic 35mm anamorphic, deep space blacks, warm amber console glow',
      durationSeconds: 6,
      imagePrompt: 'Cinematic anamorphic 35mm film still. A wide establishing shot of a deep-space observation bay. An East Asian female technician in her mid-30s wearing a charcoal-gray utility flight suit with a brass patch sits at an illuminated retro-futuristic console with glowing amber dials. Behind her, a massive curved panoramic glass window looks out into a vast pitch-black starfield. Atmospheric dust motes, moody rim lighting, 8k cinematic photorealism.',
      imageUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
      imageStatus: 'completed',
    },
    {
      id: 'scene-2',
      sceneNumber: 2,
      title: 'The Intercepted Carrier Wave',
      description: 'Maya adjusts the analog dials as the audio monitor pulses with an impossible non-random frequency.',
      setting: 'Kepler-9 Observation Bay',
      timeOfDay: 'dim_ambient',
      characters: ['Maya Lin'],
      actions: 'Her eyes widen as the needle violently twitches and a rhythmic harmonic pattern emerges.',
      dialogue: 'MAYA: Receiver seven, identify carrier.\nCOMPUTER: Carrier unlisted. Vector origin: Oort Sector Delta-4.',
      cameraDirection: 'Tight close-up on Maya’s face and eyes reflecting the amber oscilloscope wave',
      mood: 'Tense, sudden revelation, heart-rate accelerating',
      visualStyle: 'Extreme high-contrast close-up, shallow depth of field, warm amber reflections',
      durationSeconds: 5,
      imagePrompt: 'Cinematic tight close-up on the face of a 30s East Asian female space technician with sharp watchful eyes. Her face is illuminated by the rhythmic amber glow of a green and amber oscilloscope monitor reflected in her pupils. Tactile audio headphones resting on her shoulders. Cinematic film grain, shallow depth of field, tense atmosphere, 8k photograph.',
      imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
      imageStatus: 'completed',
    },
    {
      id: 'scene-3',
      sceneNumber: 3,
      title: 'The Dash Through the Corridor',
      description: 'Maya sprints down the pressurized telemetry corridor towards the primary telemetry hub.',
      setting: 'Telemetry Corridor',
      timeOfDay: 'dim_ambient',
      characters: ['Maya Lin'],
      actions: 'Her magnetic boots clatter against grated deck plates as cyan standby lights guide the way.',
      dialogue: 'COMPUTER: Signal decay estimated at ninety seconds until dissipation.',
      cameraDirection: 'Dynamic tracking shot following Maya at hip height down the industrial gangway',
      mood: 'Urgent, kinetic, clock ticking',
      visualStyle: 'Cool cyan rim-lit corridor with motion blur on background conduits, gritty sci-fi',
      durationSeconds: 4,
      imagePrompt: 'Low-angle dynamic tracking shot in an industrial spaceship corridor. A female astronaut in a dark utilitarian suit running forward with determination. Floor grated steel decking, exposed ceiling pipes venting soft steam, cool cyan LED strip lighting along baseboards. Cinematic sci-fi movie still, motion energy, 35mm lens.',
      imageUrl: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?auto=format&fit=crop&w=1200&q=80',
      imageStatus: 'completed',
    },
    {
      id: 'scene-4',
      sceneNumber: 4,
      title: 'Protocol vs Discovery',
      description: 'Maya reaches the manual override station as the quarantine countdown blinks red.',
      setting: 'Telemetry Corridor',
      timeOfDay: 'interior_lit',
      characters: ['Maya Lin'],
      actions: 'Her gloved hand trembles slightly over the hazard-striped manual override lever.',
      dialogue: 'COMPUTER: Automated quarantine protocol initiated. Purge in T-minus sixty.\nMAYA: Cancel quarantine.',
      cameraDirection: 'Dramatic macro shot focusing on the yellow-striped override toggle and Maya’s gloved hand',
      mood: 'Pivotal, high stakes, moral reckoning',
      visualStyle: 'Industrial tactile hardware detail, sharp focus on mechanical switch, red warning light flare',
      durationSeconds: 5,
      imagePrompt: 'Cinematic macro photograph of a heavy industrial emergency switch on a spacecraft wall. Bright yellow and black hazard chevrons, a knurled metal lever with safety gate. A person wearing a worn fingerless radio technician glove reaching to pull it. Pulsing red warning indicator light casting a vivid crimson flare. Highly detailed tactile textures.',
      imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
      imageStatus: 'completed',
    },
    {
      id: 'scene-5',
      sceneNumber: 5,
      title: 'The Override',
      description: 'Maya forces down the override lever, routing the incoming transmission directly to her console.',
      setting: 'Telemetry Corridor',
      timeOfDay: 'interior_lit',
      characters: ['Maya Lin'],
      actions: 'She slams down the switch. The alarm abruptly silences as a clear harmonic tone echoes through the metal hull.',
      dialogue: 'MAYA: Route directly to my personal log.',
      cameraDirection: 'Medium profile shot of Maya exhaling in relief and wonder as the pure sound washes over her',
      mood: 'Awe, goosebumps, profound breakthrough',
      visualStyle: 'Soft rim lighting, emotional relief, cinematic drama',
      durationSeconds: 5,
      imagePrompt: 'Cinematic medium profile shot of an East Asian woman astronaut in a dark uniform exhaling in awe and relief inside a spaceship control room. Soft amber and teal lighting illuminates her peaceful face. The background control panel glows calmly. Movie masterpiece, emotional drama, 8k.',
      imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
      imageStatus: 'completed',
    },
    {
      id: 'scene-6',
      sceneNumber: 6,
      title: 'Echoes in the Void',
      description: 'Exterior view of Kepler-9 station floating in deep space as a faint chromatic shimmer ripples across the horizon.',
      setting: 'Deep Space Kepler Outpost (Exterior)',
      timeOfDay: 'night',
      characters: [],
      actions: 'The station glides silently over the icy rim of the solar system, no longer alone.',
      dialogue: '',
      cameraDirection: 'Slow epic wide pull-back into the cosmic abyss, revealing the station as a solitary beacon',
      mood: 'Sublime, cosmic scale, hopeful wonder',
      visualStyle: 'Grand cosmic sci-fi landscape, sharp star points, specular sunlight catching the station hull',
      durationSeconds: 6,
      imagePrompt: 'Epic wide cinematic shot of a solitary modular space station outpost orbiting near an icy planetary ring system in deep space. Solar panels catching bright white sunlight, small warm lights glowing from observation windows. Distant nebula clouds in deep violet and indigo. Vast scale, cosmic wonder, photorealistic space render, 8k resolution.',
      imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
      imageStatus: 'completed',
    },
  ],
};
