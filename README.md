<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Universe Simulator

A Vite + React app ready to run locally and deploy on Vercel.

View your app in AI Studio: https://ai.studio/apps/f9988521-0cb5-4220-b698-20d752bf6675

## Run locally

**Prerequisites:** Node.js 20 or newer.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the app:

   ```bash
   npm run dev
   ```

## Deploy on Vercel

Vercel can detect this as a Vite project automatically. The included `vercel.json` pins the production build settings:

- Build command: `npm run build`
- Output directory: `dist`

To deploy:

1. Push this folder to a Git repository.
2. Import the repository in Vercel.
3. Keep the default framework preset as Vite.
4. Deploy.

No environment variables are required for the current app.

## Maintenance

For AI-assisted edits and a map of where each simulation behavior lives, see [docs/AI_MAINTENANCE.md](docs/AI_MAINTENANCE.md).
