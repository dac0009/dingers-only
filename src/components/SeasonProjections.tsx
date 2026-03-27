'use client';

import { LeagueData, PlayerStats } from '@/lib/types';
import PlayerHeadshot from './PlayerHeadshot';

interface Props {
  data: LeagueData;
}

/*
 * Career-Based Bayesian HR Projection Model
 *
 * Each player's projection uses THEIR OWN career HR rate as the prior,
 * not a generic league average. This makes projections immediately realistic:
 *   - Aaron Judge: career ~0.28 HR/G → early-season projection ~45 HR
 *   - A light hitter: career ~0.08 HR/G → early-season projection ~13 HR
 *
 * Formula:
 *   blended_rate = (season_HR + career_rate * prior_weight) / (season_GP + prior_weight)
 *   projection = blended_rate * 162
 *
 * prior_weight controls how quickly current season overrides career:
 *   - Set to 50 games: after ~50 games, season data and career are weighted equally
 *   - After 100+ games, current season dominates
 */
const PRIOR_WEIGHT = 50;

function projectPlayer(p: PlayerStats): number {
  const careerRate = p.career_hr_rate; // individual career HR/game
  const priorHR = careerRate * PRIOR_WEIGHT;
  const blendedRate = (p.hr_total + priorHR) / (p.games_played + PRIOR_WEIGHT);
  return Math.round(blendedRate * 162);
}

export default function SeasonProjections({ data }: Props) {
  const leagueMaxGP = Math.max(...data.players.map((p) => p.games_played), 0);

  // Project every player and sort
  const projectedPlayers = data.players
    .map((p) => ({ ...p, projected: projectPlayer(p) }))
    .sort((a, b) => b.projected - a.projected);

  const topPlayers = projectedPlayers.slice(0, 12);

  // Team projections: sum of player projections
  const teamProjections = data.teams
    .map((team) => {
      const teamProjected = team.players.reduce(
        (sum, p) => sum + projectPlayer(p), 0
      );
      return { ...team, projected: teamProjected };
    })
    .sort((a, b) => b.projected - a.projected);

  const maxTeamProjected = Math.max(...teamProjections.map((t) => t.projected), 1);

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
        {/* Model explanation */}
        <div className="bg-dinger-bg/50 border border-dinger-border/50 rounded-xl px-4 py-3">
          <p className="text-xs text-dinger-muted font-body leading-relaxed">
            Projections blend each player&apos;s <span className="text-dinger-accent font-semibold">career HR rate</span> with their current season performance.
            Early in the season, projections lean on career history. As games pile up, this year&apos;s numbers take over.
          </p>
        </div>

        {/* Team Projections */}
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-dinger-muted mb-3">
            Projected Team Totals (162 Games)
          </p>
          <div className="space-y-2.5">
            {teamProjections.map((team, i) => {
              const barPct = (team.projected / maxTeamProjected) * 100;
              return (
                <div key={team.manager} className="flex items-center gap-3">
                  <span className="font-mono text-xs text-dinger-muted w-5 text-right shrink-0">
                    {i + 1}
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
                          {team.projected}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {topPlayers.map((player) => (
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
                    {player.hr_total} HR in {player.games_played}G • Career {Math.round(player.career_hr_rate * 162)}/162
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-bold text-lg text-dinger-accent">
                    {player.projected}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
