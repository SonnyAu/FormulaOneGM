# F1 General Manager (Next.js)

Local-first Formula 1 management sim built with Next.js App Router and TypeScript.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Project checks

```bash
npm run lint
npm run typecheck
npm run build
# or all at once
npm run check
npm run check:registry
```

## Notes for dependency install reliability

- This repository now commits a project-level `.npmrc` that pins the public npm registry (`https://registry.npmjs.org/`) to avoid accidental installs against a private/company mirror.
- If your environment injects custom npm config (proxy/registry), prefer overriding at project scope or run:

```bash
npm config set registry https://registry.npmjs.org/
```

## Local-first simulation architecture

- Save data is persisted client-side in IndexedDB (`lib/storage/indexedDb.ts` + `lib/storage/saveRepository.ts`).
- Active save state is loaded into memory through `simulationSession` (`lib/sim/session.ts`) and used for all simulation work.
- Weekly progression runs through `runSimulationTick` (`lib/sim/engine.ts`), then checkpoints back to IndexedDB.
- Simulation subsystems are split by responsibility under `lib/sim/subsystems/*` (AI, decision validation, economy, development, race).
- UI consumes typed service actions instead of mutating core state directly.

## Saves/setup/dashboard flow

- App startup lands on the saves screen (`app/page.tsx`) to create/import/resume/delete local saves.
- New save creation runs through `app/team-setup/page.tsx`, where save name + difficulty + player team are selected before entering the dashboard.
- Save metadata is stored separately from full save payload in IndexedDB via `lib/storage/saveRepository.ts`.
- The simulation session service (`lib/sim/session.ts`) owns the active in-memory save and performs autosave/checkpoint writes after meaningful actions.
- Dashboard route (`app/dashboard/page.tsx`) loads the selected `saveId`, runs simulation actions, and can return to saves at any time.
