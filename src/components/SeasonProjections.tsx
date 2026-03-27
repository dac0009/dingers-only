'use client';

import { LeagueData } from '@/lib/types';
import PlayerHeadshot from './PlayerHeadshot';

interface Props {
  data: LeagueData;
}

function projectHR(hr: number, gamesPlayed: number): number {
  if (gamesPlayed <= 0) return 0;
  return Math.round((hr / gamesPlayed) * 162);
}

export default function SeasonProjections({ data }: Props) {
  // For each team, use the max games played by any player on the roster
  const teamGames = data.teams.map((team) => {
    const maxGP = Math.max(...team.players.map((p) => p.games_played), 0);
    return { manager: team.manager, gp: maxGP };
  });

  const leagueMaxGP = Math.max(...teamGames.map((t) => t.gp), 0);

  // Players with HR, sorted by projected
  const playersWithHR = data.players
    .filter((p) => p.hr_total > 0 && p.games_played > 0)
    .map((p) => ({
      ...p,
      projected: projectHR(p.hr_total, p.games_played),
      hr_per_game: p.hr_total / p.games_played,
    }))
    .sort((a, b) => b.projected - a.projected)
    .slice(0, 10);

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
          {leagueMaxGP > 0
            ? `${leagueMaxGP} game${leagueMaxGP !== 1 ? 's' : ''} played`
            : 'Season starting...'}
        </span>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Early season caveat */}
        {leagueMaxGP > 0 && leagueMaxGP <= 20 && (
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-2.5 text-xs text-amber-300/80 font-body">
            ⚠️ Small sample size — projections will stabilize as more games are played.
          </div>
        )}

        {/* Team Projections */}
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-dinger-muted mb-3">
            Projected Team Totals (162 Games)
          </p>
          <div className="space-y-2">
            {data.teams.map((team) => {
              const tg = teamGames.find((t) => t.manager === team.manager);
              const gp = tg?.gp ?? 0;
              const projected = gp > 0 ? projectHR(team.total_hr, gp) : 0;
              const maxProjected = Math.max(
                ...data.teams.map((t) => {
                  const g = teamGames.find((x) => x.manager === t.manager)?.gp ?? 0;
                  return g > 0 ? projectHR(t.total_hr, g) : 0;
                }),
                1
              );
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
                          {team.total_hr} in {gp}G
                        </span>
                        <span className="font-mono font-bold text-base text-dinger-accent">
                          {projected}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-dinger-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-700"
                        style={{ width: `${barPct}%` }}
                      />
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
          {playersWithHR.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {playersWithHR.map((player) => (
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
                      {player.manager} • {player.games_played}G
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-lg text-dinger-accent">
                      {player.projected}
                    </p>
                    <p className="font-mono text-xs text-dinger-muted">
                      ({player.hr_total} in {player.games_played}G)
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-dinger-muted text-center py-6">
              No home runs hit yet — projections will appear once dingers start flying!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
