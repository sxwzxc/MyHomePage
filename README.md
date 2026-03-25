# MyHomePage

A customizable personal start page built with **Next.js** and **EdgeOne Pages Functions**. It ships with multi-engine search, curated bookmarks, weather and visit stats, and a GitHub trending “news” feed backed by KV storage.

## Features
- Multi-engine search hero with quick keyword chips and one-tap engine switching.
- Bookmark grid with drag-and-drop sorting, quick add, custom icons, and compact/card layouts.
- Weather lookup, visit counter, and animated background presets.
- GitHub trending news with timeframe/language filters, manual refresh, and collapsible display.
- Settings are persisted via `/homepage-config` EdgeOne function using KV (`homepage:config:v1`) with optional access lock.

## Development
```bash
npm install
npm run dev
```
Visit [http://localhost:3000](http://localhost:3000) to browse the homepage. Update the homepage configuration through the UI or adjust defaults in `lib/homepage-config.ts`.

## Scripts
- `npm run dev` – start the local dev server.
- `npm run lint` – lint the project with Next.js ESLint config.
- `npm run build` – production build. Requires network access to download the Inter font from Google Fonts (used in `app/layout.tsx`).

## Project Structure
- `app/` – Next.js App Router pages and layout.
- `components/` – UI sections (search hero, bookmarks, news, etc.).
- `functions/homepage-config/` – EdgeOne Pages Function for storing homepage config in KV.
- `lib/` – shared types, defaults, and utilities.

## Deployment
Deploy to EdgeOne Pages. Ensure the KV key `homepage:config:v1` is available for the `/homepage-config` function so configuration persists between visits.
