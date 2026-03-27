import { RosterEntry, PlayerStats, TeamStanding, LeagueData } from './types';
import { readRoster } from './roster';

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';

// Cache in memory for 5 minutes to avoid hammering the API
let cache: { data: Map<number, { name: string; hr: number }>; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

interface MLBStatsResponse {
  stats?: Array<{
    splits?: Array<{
      stat?: {
        homeRuns?: number;
      };
    }>;
  }>;
  people?: Array<{
    id: number;
    fullName: string;
    stats?: Array<{
      splits?: Array<{
        stat?: {
          homeRuns?: number;
        };
      }>;
    }>;
  }>;
}

async function fetchPlayerStats(
  playerIds: number[],
  season: number
): Promise<Map<number, { name: string; hr: number }>> {
  // Check cache
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return cache.data;
  }

  const results = new Map<number, { name: string; hr: number }>();

  // MLB API supports fetching multiple people in one call
  // We'll batch in groups of 40
  const batches: number[][] = [];
  for (let i = 0; i < playerIds.length; i += 40) {
    batches.push(playerIds.slice(i, i + 40));
  }

  for (const batch of batches) {
    const ids = batch.join(',');
    const url = `${MLB_API_BASE}/people?personIds=${ids}&hydrate=stats(group=[hitting],type=[season],season=${season})`;

    try {
      const res = await fetch(url, {
        next: { revalidate: 300 },
        headers: { 'User-Agent': 'DingersOnly/1.0' },
      });

      if (!res.ok) {
        console.error(`MLB API error: ${res.status}`);
        continue;
      }

      const data: MLBStatsResponse = await res.json();

      if (data.people) {
        for (const person of data.people) {
          let hr = 0;
          if (person.stats && person.stats.length > 0) {
            const splits = person.stats[0]?.splits;
            if (splits && splits.length > 0) {
              hr = splits[0]?.stat?.homeRuns ?? 0;
            }
          }
          results.set(person.id, {
            name: person.fullName,
            hr,
          });
        }
      }
    } catch (err) {
      console.error('Error fetching MLB stats:', err);
    }
  }

  cache = { data: results, ts: Date.now() };
  return results;
}

export async function getLeagueData(season: number = 2026): Promise<LeagueData> {
  const roster: RosterEntry[] = readRoster();
  const playerIds = [...new Set(roster.map((r) => r.player_id))];
  const stats = await fetchPlayerStats(playerIds, season);

  // Build player list with roster info
  const players: PlayerStats[] = roster.map((r) => {
    const s = stats.get(r.player_id);
    return {
      player_id: r.player_id,
      player_name: s?.name ?? r.player_roster.split(', ').reverse().join(' '),
      hr_total: s?.hr ?? 0,
      manager: r.manager,
    };
  });

  // Sort by HR desc
  players.sort((a, b) => b.hr_total - a.hr_total);

  // Build team standings
  const managerMap = new Map<string, PlayerStats[]>();
  for (const p of players) {
    if (p.manager) {
      const existing = managerMap.get(p.manager) || [];
      existing.push(p);
      managerMap.set(p.manager, existing);
    }
  }

  const teamsUnsorted: TeamStanding[] = [];
  for (const [manager, teamPlayers] of managerMap) {
    const total_hr = teamPlayers.reduce((sum, p) => sum + p.hr_total, 0);
    teamsUnsorted.push({
      rank: 0,
      manager,
      total_hr,
      players: teamPlayers.sort((a, b) => b.hr_total - a.hr_total),
    });
  }

  teamsUnsorted.sort((a, b) => b.total_hr - a.total_hr);
  const teams = teamsUnsorted.map((t, i) => ({ ...t, rank: i + 1 }));

  return {
    teams,
    players,
    lastUpdated: new Date().toISOString(),
    season,
  };
}

// Search for players by name (for the admin add player feature)
export async function searchPlayers(
  query: string,
  season: number = 2026
): Promise<Array<{ id: number; name: string; team: string; hr: number }>> {
  try {
    const url = `${MLB_API_BASE}/people/search?names=${encodeURIComponent(query)}&hydrate=stats(group=[hitting],type=[season],season=${season}),currentTeam&sportIds=1&limit=15`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DingersOnly/1.0' },
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!data.people) return [];

    return data.people
      .filter((p: any) => p.primaryPosition?.type !== 'Pitcher' || p.primaryPosition?.abbreviation === 'TWP')
      .map((p: any) => {
        let hr = 0;
        if (p.stats && p.stats.length > 0) {
          const splits = p.stats[0]?.splits;
          if (splits && splits.length > 0) {
            hr = splits[0]?.stat?.homeRuns ?? 0;
          }
        }
        return {
          id: p.id,
          name: p.fullName,
          team: p.currentTeam?.abbreviation ?? 'FA',
          hr,
        };
      });
  } catch (err) {
    console.error('Player search error:', err);
    return [];
  }
}
