'use client';

import { LeagueData } from '@/lib/types';
import PlayerHeadshot from './PlayerHeadshot';

interface Props {
  data: LeagueData;
}

export default function SeasonProjections({ data }: Props) {
  // Estimate % of season played
  // MLB 2026 season: ~March 26 to ~Sept 28 = 186 days, 162 games
  const seasonStart = new Date('2026-03-26');
  const seasonEnd = new Date('2026-09-28');
  const now = new Date();

  const totalDays = (seasonEnd.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24);
  const daysElapsed = Math.max(0, (now.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
  const pctPlayed = Math.min(Math.max(daysElapsed / totalDays, 0.01), 1);
  const gamesEstimate = Math.round(pctPlayed * 162);

  return (
    <div className="bg-dinger-card border border-dinger-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dinger-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="font-display text-xl text-dinger-text-bright tracking-tight">
            SEASON PROJECTIONS
          </h3>
        </div>
        <span className="text-xs font-mono text-dinger-muted">
          ~{gamesEstimate}/162 games • {Math.round(pctPlayed * 100)}% of season
        </span>
      </div>

      {/* Team Projections */}
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-dinger-muted mb-3">
            Projected Team Totals (162 Games)
          </p>
          <div className="space-y-2">
            {data.teams.map((team) => {
              const projected = pctPlayed > 0 ? Math.round(team.total_hr / pctPlayed) : 0;
              const maxProjected = data.teams.reduce((max, t) => {
                const p = pctPlayed > 0 ? Math.round(t.total_hr / pctPlayed) : 0;
                return Math.max(max, p);
              }, 1);
              const barPct = maxProjected > 0 ? (projected / maxProjected) * 100 : 0;

              return (
                <div key={team.manager} className="flex items-center gap-3">
                  <span className="font-mono text-xs text-dinger-muted w-5 text-right shrink-0">
                    {team.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="font-body text-sm text-dinger-text truncate">
                        {team.manager}
                      </span>
                      <div className="flex items-baseline gap-2 shrink-0 ml-2">
                        <span className="font-mono text-xs text-dinger-muted">
                          {team.total_hr} actual
                        </span>
                        <span className="font-mono font-bold text-base text-dinger-accent">
                          {projected}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-dinger-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full relative overflow-hidden" style={{ width: `${barPct}%` }}>
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-600 to-amber-400" />
                        <div
                          className="absolute inset-0 bg-gradient-to-r from-amber-400/50 to-transparent"
                          style={{ width: `${pctPlayed * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Player Projections */}
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-dinger-muted mb-3">
            Top Player Projections
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.players
              .filter((p) => p.hr_total > 0)
              .slice(0, 10)
              .map((player) => {
                const projected = pctPlayed > 0 ? Math.round(player.hr_total / pctPlayed) : 0;
                return (
                  <div
                    key={player.player_id}
                    className="flex items-center gap-3 bg-dinger-bg/50 rounded-xl p-3 border border-dinger-border/50"
                  >
                    <PlayerHeadshot
                      playerId={player.player_id}
                      playerName={player.player_name}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-dinger-text truncate">
                        {player.player_name}
                      </p>
                      <p className="text-xs text-dinger-muted truncate">
                        {player.manager}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-bold text-lg text-dinger-accent">
                        {projected}
                      </p>
                      <p className="font-mono text-xs text-dinger-muted">
                        ({player.hr_total} now)
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
          {data.players.filter((p) => p.hr_total > 0).length === 0 && (
            <p className="text-sm text-dinger-muted text-center py-6">
              No home runs hit yet — projections will appear once dingers start flying!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
