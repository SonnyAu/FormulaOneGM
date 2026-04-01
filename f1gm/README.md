This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Local-first simulation architecture

- Save data is persisted client-side in IndexedDB (`lib/storage/indexedDb.ts` + `lib/storage/saveRepository.ts`).
- Active save state is loaded into memory through `simulationSession` (`lib/sim/session.ts`) and used for all simulation work.
- Weekly progression runs through `runSimulationTick` (`lib/sim/engine.ts`), then checkpoints back to IndexedDB.
- Simulation subsystems are split by responsibility under `lib/sim/subsystems/*` (AI, decision validation, economy, development, race).
- UI consumes typed service actions instead of mutating core state directly.


## Local-first saves flow

- App startup lands on the saves screen (`app/page.tsx`) to create/import/resume/delete local saves.
- New save creation runs through `app/team-setup/page.tsx`, where save name + difficulty + player team are selected before entering the dashboard.
- Save metadata is stored separately from full save payload in IndexedDB via `lib/storage/saveRepository.ts`.
- The simulation session service (`lib/sim/session.ts`) owns the active in-memory save and performs autosave/checkpoint writes after meaningful actions.
- Dashboard route (`app/dashboard/page.tsx`) loads the selected `saveId`, runs simulation actions, and can return to saves at any time.
