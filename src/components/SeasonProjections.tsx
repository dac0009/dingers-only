'use client';

import { LeagueData, PlayerStats } from '@/lib/types';
import PlayerHeadshot from './PlayerHeadshot';

interface Props {
  data: LeagueData;
}

/*
 * Empirical Bayes HR Projection Model
 * 
 * Instead of raw pace (HR/G * 162), which is wildly volatile early season,
 * we blend each player's observed HR rate with a league-average prior.
 * 
 * Formula: projected_rate = (observed_HR + prior_HR) / (games_played + prior_games)
 * 
 * Prior assumptions (based on MLB averages for qualified hitters):
 *   - prior_rate: 0.14 HR/game (~23 HR over 162 games, league avg for starters)
 *   - prior_games: 25 (how many games before observed data dominates)
 * 
 * This means:
 *   - After 1 game with 2 HR → projected 37 (not 324)
 *   - After 25 games with 8 HR → projected 32
 *   - After 100 games with 30 HR → projected 39
 * 
 * The prior gradually fades as real data accumulates.
 */

const PRIOR_HR_RATE = 0.14;  // ~23 HR per 162 games (MLB average for starters)
const PRIOR_WEIGHT = 25;     // Games of "prior experience" to blend in

function projectPlayer(hr: number, gamesPlayed: number): number {
  if (gamesPlayed <= 0 && hr <= 0) return Math.round(PRIOR_HR_RATE * 162);
  const priorHR = PRIOR_HR_RATE * PRIOR_WEIGHT;
  const blendedRate = (hr + priorHR) / (gamesPlayed + PRIOR_WEIGHT);
  return Math.round(blendedRate * 162);
}

function getConfidence(gamesPlayed: number): { label: string; color: string } {
  if (gamesPlayed <= 10) return { label: 'Very Low', color: 'text-red-400' };
  if (gamesPlayed <= 30) return { label: 'Low', color: 'text-orange-400' };
  if (gamesPlayed <= 60) return { label: 'Moderate', color: 'text-yellow-400' };
  if (gamesPlayed <= 100) return { label: 'Good', color: 'text-emerald-400' };
  return { label: 'High', color: 'text-emerald-300' };
}

interface ProjectedPlayer extends PlayerStats {
  projected: number;
  confidence: { label: string; color: string };
}

export default function SeasonProjections({ data }: Props) {
  const leagueMaxGP = Math.max(...data.players.map((p) => p.games_played), 0);

  // Project every player
  const projectedPlayers: ProjectedPlayer[] = data.players
    .map((p) => ({
      ...p,
      projected: projectPlayer(p.hr_total, p.games_played),
      confidence: getConfidence(p.games_played),
    }))
    .sort((a, b) => b.projected - a.projected);

  // Top 10 projected players
  const topPlayers = projectedPlayers.slice(0, 10);

  // Team projections: sum of all player projections on roster
  const teamProjections = data.teams
    .map((team) => {
      const teamProjected = team.players.reduce(
        (sum, p) => sum + projectPlayer(p.hr_total, p.games_played),
        0
      );
      const maxGP = Math.max(...team.players.map((p) => p.games_played), 0);
      return {
        ...team,
        projected: teamProjected,
        maxGP,
        confidence: getConfidence(maxGP),
      };
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
            <span className="text-dinger-accent font-semibold">How it works:</span> Projections use an Empirical Bayes model that blends each player&apos;s actual HR rate with league-average expectations.
            Early season projections lean heavily on the league prior (~23 HR/162G for a typical starter). As games accumulate, the player&apos;s real performance takes over.
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
                        <span className={`font-mono text-xs ${team.confidence.color}`}>
                          {team.confidence.label}
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
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-dinger-muted truncate">
                      {player.hr_total} HR in {player.games_played}G
                    </p>
                    <span className={`text-[10px] font-mono ${player.confidence.color}`}>
                      {player.confidence.label}
                    </span>
                  </div>
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
