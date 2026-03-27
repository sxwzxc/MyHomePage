# MyHomePage

[中文](./README.md) | English

A clean and efficient personal start page built with **Next.js** static export and **EdgeOne Pages Functions**, with persistent configuration via KV storage.

## Features

### Search
- Built-in Google, Bing, Baidu, DuckDuckGo engines with custom engine support
- One-tap engine switching, quick keyword chips, enter to jump

### Bookmarks
- Drag-and-drop sorting, quick add, right-click context menu for edit/delete
- Card / compact layout modes, 1–6 adjustable columns
- Auto-fetch website favicons (3-source fallback) with scheduled refresh

### News Aggregation
- **11 trending sources**: 60s Daily Brief, Toutiao, Weibo, Zhihu, Quark, Baidu, Bilibili, Douyin, Xiaohongshu, Douban Movies, Dongchedi
- Auto-carousel / manual switching, collapsible display
- KV cache (30-min TTL) with background incremental refresh

### Dashboard Info
- Canvas analog clock with millisecond-smooth animation
- Real-time weather lookup (configurable city)
- Page visit counter

### Visual Customization
- 6 gradient animation presets (Default / Ocean / Sunset / Forest / Aurora / Fire)
- Custom image background with blur and opacity controls
- Solid color background

### Security
- Password-protected settings page with session-persistent unlock state

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, `output: 'export'` static export) |
| UI | React 18 + Radix UI + Lucide Icons |
| Styling | Tailwind CSS 3 + class-variance-authority |
| Backend | EdgeOne Pages Functions (Cloudflare Workers format) |
| Storage | EdgeOne KV |
| Language | TypeScript (frontend) / JavaScript (Functions) |

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

In development, Functions run on `localhost:8088` and the frontend is available at [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev    # Start development server
npm run build  # Production build (static export to out/)
npm run lint   # Run ESLint
```

> Network access is required during build to download Google Fonts (Inter).

## Project Structure

```
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (fonts, metadata)
│   ├── page.tsx                # Homepage
│   ├── settings/page.tsx       # Settings page
│   └── globals.css             # Global styles
├── components/
│   ├── HomepageDashboard.tsx   # Main dashboard (search, bookmarks, weather, clock)
│   ├── SettingsDashboard.tsx   # Settings dashboard (configuration management)
│   ├── NewsSection.tsx         # News trending component
│   ├── AnalogClock.tsx         # Canvas analog clock
│   ├── AnimatedBackground.tsx  # Animated backgrounds
│   ├── Kv.tsx                  # KV storage demo
│   └── ui/                     # Base UI components (Accordion, Button, ContextMenu)
├── functions/
│   ├── homepage-config/        # Config read/write (KV key: homepage:config:v1)
│   ├── news/                   # News aggregation engine (11 sources + cache)
│   ├── favicon-fetch/          # Favicon fetch proxy
│   ├── visit/                  # Visit counter
│   ├── password-verify/        # Password verification
│   ├── kv-list/                # KV data browser (debug)
│   └── kv-batch-set/           # KV batch write test
├── lib/
│   ├── homepage-config.ts      # Config type definitions and defaults
│   ├── utils.ts                # API call wrappers (with sessionStorage cache)
│   └── unlock-state.ts         # Settings unlock state management
├── public/                     # Static assets
└── next.config.mjs             # Static export configuration
```

## Environment Variables

Configure in `.env`:

```env
password=your_password_here
```

- `password` — Access password for the settings page (default: `please_change_me`)

## Deployment

1. Build the project with `npm run build`; output is in the `out/` directory
2. Deploy to **EdgeOne Pages**
3. Bind a KV namespace and ensure the key `homepage:config:v1` is available

> The `functions/` directory uses the Cloudflare Pages Functions format, which is natively compatible with EdgeOne Pages.

## License

MIT
