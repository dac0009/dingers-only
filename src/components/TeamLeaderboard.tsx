'use client';

import { TeamStanding } from '@/lib/types';

interface Props {
  teams: TeamStanding[];
  onSelectTeam: (team: TeamStanding) => void;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="rank-gold font-display text-2xl">1</span>;
  if (rank === 2) return <span className="rank-silver font-display text-2xl">2</span>;
  if (rank === 3) return <span className="rank-bronze font-display text-2xl">3</span>;
  return <span className="font-display text-2xl text-dinger-muted">{rank}</span>;
}

function HRBar({ hr, maxHR }: { hr: number; maxHR: number }) {
  const pct = maxHR > 0 ? (hr / maxHR) * 100 : 0;
  return (
    <div className="h-2 bg-dinger-border rounded-full overflow-hidden flex-1 max-w-[200px]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function TeamLeaderboard({ teams, onSelectTeam }: Props) {
  const maxHR = teams.length > 0 ? teams[0].total_hr : 1;

  return (
    <div className="bg-dinger-card border border-dinger-border rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
      {/* Table header */}
      <div className="grid grid-cols-[60px_1fr_120px_200px_100px] sm:grid-cols-[80px_1fr_120px_200px_120px] items-center px-4 sm:px-6 py-3 border-b border-dinger-border bg-dinger-card/80 backdrop-blur">
        <span className="text-xs font-mono uppercase text-dinger-muted tracking-widest">Rank</span>
        <span className="text-xs font-mono uppercase text-dinger-muted tracking-widest">Manager</span>
        <span className="text-xs font-mono uppercase text-dinger-muted tracking-widest text-center">Dingers</span>
        <span className="text-xs font-mono uppercase text-dinger-muted tracking-widest hidden sm:block">Progress</span>
        <span></span>
      </div>

      {/* Rows */}
      {teams.map((team, i) => (
        <div
          key={team.manager}
          className="group grid grid-cols-[60px_1fr_120px_200px_100px] sm:grid-cols-[80px_1fr_120px_200px_120px] items-center px-4 sm:px-6 py-4 border-b border-dinger-border/50 row-glow cursor-pointer transition-all duration-200"
          style={{ animationDelay: `${i * 60}ms` }}
          onClick={() => onSelectTeam(team)}
        >
          <div className="flex items-center justify-center">
            <RankBadge rank={team.rank} />
          </div>

          <div className="flex flex-col">
            <span className="font-body font-semibold text-dinger-text-bright text-base group-hover:text-dinger-accent transition-colors">
              {team.manager}
            </span>
            <span className="text-xs text-dinger-muted font-mono">
              {team.players.length} players
            </span>
          </div>

          <div className="text-center">
            <span className="font-mono font-bold text-2xl text-dinger-text-bright">
              {team.total_hr}
            </span>
          </div>

          <div className="hidden sm:flex items-center">
            <HRBar hr={team.total_hr} maxHR={maxHR} />
          </div>

          <div className="flex justify-end">
            <button
              className="text-xs font-mono px-3 py-1.5 rounded-lg border border-dinger-border text-dinger-muted hover:text-dinger-accent hover:border-dinger-accent transition-all duration-200 group-hover:border-dinger-accent/40"
              onClick={(e) => {
                e.stopPropagation();
                onSelectTeam(team);
              }}
            >
              Roster →
            </button>
          </div>
        </div>
      ))}

      {teams.length === 0 && (
        <div className="text-center py-12 text-dinger-muted font-body">
          No team data available yet. The season may not have started.
        </div>
      )}
    </div>
  );
}
