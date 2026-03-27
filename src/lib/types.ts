export interface RosterEntry {
  manager: string;
  player_id: number;
  player_roster: string;
}

export interface PlayerStats {
  player_id: number;
  player_name: string;
  hr_total: number;
  games_played: number;
  manager: string | null;
}

export interface TeamStanding {
  rank: number;
  manager: string;
  total_hr: number;
  players: PlayerStats[];
}

export interface LeagueData {
  teams: TeamStanding[];
  players: PlayerStats[];
  lastUpdated: string;
  season: number;
}

export interface TransactionLog {
  id: string;
  timestamp: string;
  manager: string;
  type: 'add' | 'drop' | 'swap';
  playerAdded?: { id: number; name: string };
  playerDropped?: { id: number; name: string };
}
