# AI maintenance guide

This project is a Vite + React + Three.js simulation of the Universe timeline.

Use this file as the first stop before changing visuals or timeline behavior.

## Main app map

- `src/App.tsx`
  - Overall page layout.
  - Header, mode buttons, simulator canvas, bottom timeline controls.

- `src/components/UniverseSimulator.tsx`
  - Main Three.js scene composition.
  - Still owns the heavy particle field generation, plasma fog, background stars, nebulae, showcase galaxies, centerless vectors, and the final `<Canvas>`.
  - Keep this file focused on scene composition and large simulation systems.

- `src/components/universe/CameraDirector.tsx`
  - Camera movement and OrbitControls behavior.
  - Edit this for zoom distance, orbit movement, autorotation, and centerless camera controls.

- `src/components/universe/SceneHud.tsx`
  - In-scene labels shown over the canvas.
  - Edit this for the small cinematic caption, status percentages, and centerless observer marker.

- `src/components/universe/particleAppearance.ts`
  - Particle scale, color, alpha, and point size by timeline progress.
  - Edit this when stars, plasma, galaxies, or the cosmic web look too dim, too bright, too small, or too abrupt.

- `src/components/PlayControls.tsx`
  - Timeline playback loop and per-phase playback speed.
  - Edit `getPlaybackSpeed()` when a phase feels too fast or too slow.

- `src/components/TimelineSlider.tsx`
  - Bottom timeline UI and current cosmic age label.

- `src/utils/cosmicTime.ts`
  - Maps timeline progress `0..100` to human-readable cosmic age labels.
  - Edit `timelineAnchors` to change when the UI shows thousands, millions, or billions of years.

- `src/utils/visualPhase.ts`
  - Maps progress `0..100` to named phases.
  - Also owns phase titles, captions, status values, and camera distance targets.

- `src/data/epochs.ts`
  - Educational panel content: names, age text, temperatures, and explanations.

## Common edits

### A phase changes too abruptly

Check these files in this order:

1. `src/components/PlayControls.tsx`
   - Lower `getPlaybackSpeed(progress)` for that progress range.

2. `src/utils/visualPhase.ts`
   - Smooth the phase boundaries or camera distance.
   - Use `smoothstep(start, end, progress)` instead of hard jumps.

3. `src/components/universe/particleAppearance.ts`
   - Spread alpha, size, color, or scale transitions across a wider progress range.

4. `src/components/UniverseSimulator.tsx`
   - Only if the actual particle positions or galaxy formation math needs to change.

### Text or education content is wrong

Use `src/data/epochs.ts` for the side panel content.

Use `src/utils/visualPhase.ts` for the small canvas captions and status values.

Use `src/utils/cosmicTime.ts` for the live timeline age label.

### Vercel deploy settings

Use `vercel.json`.

Current settings:

- Build command: `npm run build`
- Output directory: `dist`
- Framework: Vite

## Safety notes

- Keep `progress` as the shared timeline value from `0` to `100`.
- Prefer gradual transitions with `smoothstep()` and `THREE.MathUtils.lerp()`.
- Avoid adding new global random values during animation; most particle fields are intentionally generated once with deterministic seeded values.
- After visual changes, run:

```bash
npm run lint
npm run build
```

## Refactor direction

`UniverseSimulator.tsx` is smaller now, but can still be split further later:

- Move particle field generation into `src/components/universe/particleField.ts`.
- Move shader material factories into `src/components/universe/materials.ts`.
- Move background fog, stars, and nebulae into `src/components/universe/BackgroundEffects.tsx`.
- Move showcase galaxies into `src/components/universe/ScaleJourney.tsx`.

Do those one at a time and run `npm run lint` after each extraction.
