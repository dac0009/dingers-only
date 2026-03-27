'use client';

import { LeagueData } from '@/lib/types';
import PlayerHeadshot from './PlayerHeadshot';

interface Props {
  data: LeagueData;
}

export default function LeagueStatsHero({ data }: Props) {
  const totalHR = data.players.reduce((sum, p) => sum + p.hr_total, 0);
  const playersWithHR = data.players.filter((p) => p.hr_total > 0).length;
  const topPlayer = data.players.length > 0 ? data.players[0] : null;
  const topTeam = data.teams.length > 0 ? data.teams[0] : null;

  // Top 3 HR hitters for the podium
  const podium = data.players.filter((p) => p.hr_total > 0).slice(0, 3);

  return (
    <div className="mb-8 space-y-6">
      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="League Dingers"
          value={totalHR}
          icon="💣"
          accent
        />
        <StatCard
          label="Players to Go Yard"
          value={playersWithHR}
          icon="🔥"
          subtitle={`of ${data.players.length}`}
        />
        <StatCard
          label="HR Leader"
          value={topPlayer?.hr_total ?? 0}
          icon="👑"
          subtitle={topPlayer?.player_name?.split(' ').pop() ?? '—'}
        />
        <StatCard
          label="Top Team"
          value={topTeam?.total_hr ?? 0}
          icon="🏆"
          subtitle={topTeam ? truncate(topTeam.manager, 14) : '—'}
        />
      </div>

      {/* Top Dingers Podium — only shows if anyone has HR */}
      {podium.length > 0 && (
        <div className="bg-dinger-card border border-dinger-border rounded-2xl p-5 overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">☄️</span>
            <h3 className="font-display text-xl text-dinger-text-bright tracking-tight">
              DINGER LEADERS
            </h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {podium.map((player, i) => {
              const medals = ['🥇', '🥈', '🥉'];
              const barColors = [
                'from-amber-500 to-yellow-400',
                'from-slate-400 to-slate-300',
                'from-amber-700 to-amber-500',
              ];
              const maxHR = podium[0]?.hr_total || 1;
              const pct = (player.hr_total / maxHR) * 100;

              return (
                <div
                  key={player.player_id}
                  className="flex-1 flex items-center gap-3 bg-dinger-bg/50 rounded-xl p-3 border border-dinger-border/50"
                >
                  <div className="relative shrink-0">
                    <PlayerHeadshot playerId={player.player_id} playerName={player.player_name} size="lg" />
                    <span className="absolute -bottom-1 -right-1 text-lg">{medals[i]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <a
                        href={`https://baseballsavant.mlb.com/savant-player/${player.player_name.toLowerCase().replace(/\s+/g, '-')}-${player.player_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-body font-semibold text-sm text-blue-400 hover:text-blue-300 truncate"
                      >
                        {player.player_name}
                      </a>
                      <span className="font-mono font-bold text-lg text-dinger-text-bright shrink-0">
                        {player.hr_total}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-dinger-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${barColors[i]} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-dinger-muted mt-1 truncate">
                      {player.manager}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  subtitle,
  accent,
}: {
  label: string;
  value: number;
  icon: string;
  subtitle?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 ${
        accent
          ? 'bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20'
          : 'bg-dinger-card border-dinger-border'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-dinger-muted mb-1">
            {label}
          </p>
          <p
            className={`font-mono font-bold text-3xl ${
              accent ? 'text-dinger-accent' : 'text-dinger-text-bright'
            }`}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-dinger-muted mt-0.5">{subtitle}</p>
          )}
        </div>
        <span className="text-2xl opacity-60">{icon}</span>
      </div>
    </div>
  );
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}
