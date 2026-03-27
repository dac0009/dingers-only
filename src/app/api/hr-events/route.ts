import { NextResponse } from 'next/server';
import { readRoster } from '@/lib/roster';

export const dynamic = 'force-dynamic';

interface HREvent {
  player_name: string;
  player_id: number;
  hc_x: number;
  hc_y: number;
  hit_distance: number;
  exit_velo: number;
  launch_angle: number;
  game_date: string;
}

// Cache HR events for 10 minutes
let hrCache: { data: Map<string, HREvent[]>; ts: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000;

function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (values[i] || '').trim();
    });
    return row;
  });
}

async function fetchHREvents(
  playerIds: number[],
  season: number
): Promise<HREvent[]> {
  // Build the Baseball Savant URL
  const batterParams = playerIds
    .map((id) => `batters_lookup%5B%5D=${id}`)
    .join('&');

  const url = `https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfAB=home%5C.%5C.run%7C&hfSea=${season}%7C&player_type=batter&hfGT=R%7C&min_pitches=0&min_results=0&group_by=name&sort_col=pitches&player_event_sort=api_p_release_speed&sort_order=desc&min_abs=0&type=details&${batterParams}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; DingersOnly/1.0)',
      },
    });

    if (!res.ok) {
      console.error(`Savant API error: ${res.status}`);
      return [];
    }

    const csv = await res.text();
    const rows = parseCSV(csv);

    return rows
      .filter((r) => r.hc_x && r.hc_y && r.events === 'home_run')
      .map((r) => ({
        player_name: r.player_name || 'Unknown',
        player_id: parseInt(r.batter, 10) || 0,
        hc_x: parseFloat(r.hc_x) || 0,
        hc_y: parseFloat(r.hc_y) || 0,
        hit_distance: parseInt(r.hit_distance_sc, 10) || 0,
        exit_velo: parseFloat(r.launch_speed) || 0,
        launch_angle: parseInt(r.launch_angle, 10) || 0,
        game_date: r.game_date || '',
      }));
  } catch (err) {
    console.error('Error fetching HR events:', err);
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const manager = searchParams.get('manager');
  const season = parseInt(searchParams.get('season') || '2026', 10);

  if (!manager) {
    return NextResponse.json(
      { error: 'manager parameter required' },
      { status: 400 }
    );
  }

  // Check cache
  if (hrCache && Date.now() - hrCache.ts < CACHE_TTL) {
    const cached = hrCache.data.get(manager);
    if (cached) {
      return NextResponse.json(cached);
    }
  }

  const roster = readRoster();
  const teamPlayers = roster.filter((r) => r.manager === manager);
  if (teamPlayers.length === 0) {
    return NextResponse.json([]);
  }

  const playerIds = teamPlayers.map((r) => r.player_id);
  const events = await fetchHREvents(playerIds, season);

  // Update cache
  if (!hrCache || Date.now() - hrCache.ts >= CACHE_TTL) {
    hrCache = { data: new Map(), ts: Date.now() };
  }
  hrCache.data.set(manager, events);

  return NextResponse.json(events);
}
