# 🏟️ Dingers Only — Fantasy HR League

A live fantasy baseball league website that **only tracks home runs**, pulling real-time data from the MLB Stats API (Baseball Savant / Statcast).

## Features

- **Live HR Leaderboard** — Team standings and player rankings update every 5 minutes
- **Auto-refresh** — Data fetches from MLB on every page load
- **Team Detail Modals** — Click any team to see their full roster with HR counts
- **Player Search & Sort** — Filter by player name, manager, or sort by HR/name/manager
- **Admin Panel** (`/admin`) — Add, drop, or swap players on any team's roster
- **Transaction Log** — Full history of all roster moves
- **Baseball Savant Links** — Every player links to their Savant profile
- **Dark Theme** — Professional scoreboard-style design

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS v4**
- **MLB Stats API** (`statsapi.mlb.com`)

## Deploying to Vercel

### Option A: Git Integration (Recommended)

1. Push this project to a GitHub/GitLab/Bitbucket repo
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repo
4. Vercel auto-detects Next.js — just click **Deploy**

### Option B: Vercel CLI

```bash
npm install -g vercel
vercel login
vercel deploy --prod
```

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
├── data/
│   ├── rosters.csv          # League rosters (manager, player_id, player_name)
│   └── transactions.json    # Transaction history log
├── src/
│   ├── app/
│   │   ├── page.tsx         # Main league page
│   │   ├── admin/page.tsx   # Admin roster management
│   │   ├── api/
│   │   │   ├── stats/       # GET /api/stats — live HR data from MLB
│   │   │   └── roster/      # GET/POST roster management + player search
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/          # UI components
│   ├── lib/
│   │   ├── mlb-api.ts       # MLB Stats API integration
│   │   ├── roster.ts        # Roster CSV read/write utilities
│   │   └── types.ts         # TypeScript interfaces
```

## Admin Panel

Navigate to `/admin` to manage rosters:
- **Add Player** — Search MLB players by name and add to a team
- **Drop Player** — Remove a player from a team
- **Swap Player** — Replace one player with another in a single transaction

## Important Notes

- **Season**: Currently set to `2025`. Update the season parameter in `src/app/page.tsx` and API routes when the season changes.
- **Roster file**: `data/rosters.csv` is the source of truth for team rosters. On Vercel's serverless environment, file writes (admin actions) will only persist within the same instance. For persistent storage in production, consider migrating to Vercel KV, a database, or a GitHub-backed storage approach.
- **Rate limiting**: The MLB API is called with a 5-minute in-memory cache to avoid excessive requests.

## Data Attribution

All baseball statistics provided by [Baseball Savant](https://baseballsavant.mlb.com/) via the MLB Stats API.
