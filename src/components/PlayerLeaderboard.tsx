'use client';

import { useState, useMemo } from 'react';
import { PlayerStats } from '@/lib/types';
import PlayerHeadshot from './PlayerHeadshot';

interface Props {
  players: PlayerStats[];
}

function RankCell({ rank }: { rank: number }) {
  if (rank === 1) return <span className="rank-gold font-display text-xl">1</span>;
  if (rank === 2) return <span className="rank-silver font-display text-xl">2</span>;
  if (rank === 3) return <span className="rank-bronze font-display text-xl">3</span>;
  return <span className="font-display text-lg text-dinger-muted">{rank}</span>;
}

export default function PlayerLeaderboard({ players }: Props) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'hr' | 'name' | 'manager'>('hr');

  const filtered = useMemo(() => {
    let list = [...players];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.player_name.toLowerCase().includes(q) ||
          (p.manager && p.manager.toLowerCase().includes(q))
      );
    }
    if (sortBy === 'name') list.sort((a, b) => a.player_name.localeCompare(b.player_name));
    else if (sortBy === 'manager') list.sort((a, b) => (a.manager ?? '').localeCompare(b.manager ?? ''));
    else list.sort((a, b) => b.hr_total - a.hr_total);
    return list;
  }, [players, search, sortBy]);

  return (
    <div className="bg-dinger-card border border-dinger-border rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
      {/* Search & Filter bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 sm:px-6 border-b border-dinger-border">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dinger-muted"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search players or managers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-dinger-bg border border-dinger-border rounded-xl text-sm font-body text-dinger-text placeholder:text-dinger-muted focus:outline-none focus:border-dinger-accent focus:ring-1 focus:ring-dinger-accent/30 transition-all"
          />
        </div>
        <div className="flex gap-1 bg-dinger-bg border border-dinger-border rounded-xl p-0.5">
          {(['hr', 'name', 'manager'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all ${
                sortBy === s
                  ? 'bg-dinger-accent text-dinger-bg font-bold'
                  : 'text-dinger-muted hover:text-dinger-text'
              }`}
            >
              {s === 'hr' ? 'HR' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[50px_1fr_140px_80px] sm:grid-cols-[60px_1fr_160px_140px_80px] items-center px-4 sm:px-6 py-2.5 border-b border-dinger-border bg-dinger-card/80">
        <span className="text-xs font-mono uppercase text-dinger-muted tracking-widest">#</span>
        <span className="text-xs font-mono uppercase text-dinger-muted tracking-widest">Player</span>
        <span className="text-xs font-mono uppercase text-dinger-muted tracking-widest">Manager</span>
        <span className="text-xs font-mono uppercase text-dinger-muted tracking-widest hidden sm:block">Progress</span>
        <span className="text-xs font-mono uppercase text-dinger-muted tracking-widest text-center">HR</span>
      </div>

      {/* Player rows */}
      <div className="max-h-[600px] overflow-y-auto">
        {filtered.map((player, i) => {
          const rank = sortBy === 'hr' ? i + 1 : players.indexOf(player) + 1;
          const savantUrl = `https://baseballsavant.mlb.com/savant-player/${player.player_name.toLowerCase().replace(/\s+/g, '-')}-${player.player_id}`;
          const maxHR = players.length > 0 ? players[0].hr_total : 1;
          const pct = maxHR > 0 ? (player.hr_total / maxHR) * 100 : 0;

          return (
            <div
              key={`${player.player_id}-${player.manager}`}
              className="grid grid-cols-[50px_1fr_140px_80px] sm:grid-cols-[60px_1fr_160px_140px_80px] items-center px-4 sm:px-6 py-3 border-b border-dinger-border/30 row-glow transition-all duration-150"
            >
              <div className="flex items-center justify-center">
                <RankCell rank={sortBy === 'hr' ? i + 1 : rank} />
              </div>

              <div className="flex items-center gap-2">
                <PlayerHeadshot playerId={player.player_id} playerName={player.player_name} size="sm" />
                <a
                  href={savantUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body font-medium text-blue-400 hover:text-blue-300 hover:underline transition-colors text-sm sm:text-base"
                >
                  {player.player_name}
                </a>
              </div>

              <div className="text-xs sm:text-sm text-dinger-muted font-body truncate">
                {player.manager ?? 'Free Agent'}
              </div>

              <div className="hidden sm:flex items-center">
                <div className="h-2 bg-dinger-border rounded-full overflow-hidden flex-1">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      player.hr_total > 0
                        ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                        : ''
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="text-center">
                <span className={`font-mono font-bold text-lg ${
                  player.hr_total > 0 ? 'text-dinger-text-bright' : 'text-dinger-muted'
                }`}>
                  {player.hr_total}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-dinger-muted font-body">
          No players match your search.
        </div>
      )}

      {/* Footer count */}
      <div className="px-6 py-3 border-t border-dinger-border text-xs font-mono text-dinger-muted">
        Showing {filtered.length} of {players.length} players
      </div>
    </div>
  );
}
