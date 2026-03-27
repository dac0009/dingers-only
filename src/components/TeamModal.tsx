'use client';

import { useEffect } from 'react';
import { TeamStanding } from '@/lib/types';

interface Props {
  team: TeamStanding;
  onClose: () => void;
}

export default function TeamModal({ team, onClose }: Props) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-dinger-card border border-dinger-border rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-dinger-border">
          <div>
            <h2 className="font-display text-3xl text-dinger-text-bright tracking-tight">
              {team.manager}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-mono text-sm text-dinger-muted">
                Rank #{team.rank}
              </span>
              <span className="font-mono text-sm text-dinger-accent font-bold">
                {team.total_hr} HR
              </span>
              <span className="font-mono text-sm text-dinger-muted">
                {team.players.length} players
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dinger-border transition-colors text-dinger-muted hover:text-dinger-text"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Player list */}
        <div className="overflow-y-auto max-h-[60vh]">
          {/* Quick team stats */}
          {team.total_hr > 0 && (
            <div className="px-6 py-3 border-b border-dinger-border bg-dinger-bg/30">
              <p className="text-xs font-mono text-dinger-muted mb-1">HR DISTRIBUTION</p>
              <div className="flex h-3 rounded-full overflow-hidden bg-dinger-border">
                {team.players.filter(p => p.hr_total > 0).map((player, i) => {
                  const pct = (player.hr_total / team.total_hr) * 100;
                  const colors = ['bg-amber-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
                  return (
                    <div
                      key={player.player_id}
                      className={`${colors[i % colors.length]} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                      title={`${player.player_name}: ${player.hr_total} HR`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {team.players.map((player, i) => {
            const savantUrl = `https://baseballsavant.mlb.com/savant-player/${player.player_name.toLowerCase().replace(/\s+/g, '-')}-${player.player_id}`;
            const maxPlayerHR = team.players[0]?.hr_total || 1;
            const pct = maxPlayerHR > 0 ? (player.hr_total / maxPlayerHR) * 100 : 0;
            return (
              <div
                key={player.player_id}
                className="flex items-center justify-between px-6 py-3 border-b border-dinger-border/30 row-glow"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="font-mono text-xs text-dinger-muted w-6 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <a
                      href={savantUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-body text-blue-400 hover:text-blue-300 hover:underline transition-colors text-sm block truncate"
                    >
                      {player.player_name}
                    </a>
                    {player.hr_total > 0 && (
                      <div className="mt-1 h-1 bg-dinger-border rounded-full overflow-hidden max-w-[140px]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <span className={`font-mono font-bold text-lg ml-3 ${
                  player.hr_total > 0 ? 'text-dinger-text-bright' : 'text-dinger-muted'
                }`}>
                  {player.hr_total}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
