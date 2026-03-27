'use client';

import { useState, useMemo } from 'react';
import { LeagueData } from '@/lib/types';
import PlayerHeadshot from './PlayerHeadshot';

interface Props {
  data: LeagueData;
}

interface HRDot {
  player_name: string;
  player_id: number;
  manager: string;
  x: number;
  y: number;
  hr_number: number;
  exit_velo: number;
  launch_angle: number;
  distance: number;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function generateHRPositions(
  playerId: number,
  playerName: string,
  manager: string,
  hrCount: number
): HRDot[] {
  const dots: HRDot[] = [];
  // Home plate at (200, 370), fence at ~radius 145, stands from 145-185
  for (let i = 0; i < hrCount; i++) {
    const seed = playerId * 1000 + i;
    const angle = (seededRandom(seed) * 100 - 50) * (Math.PI / 180);
    // Land in the stands: radius 150-185 from home plate
    const dist = 150 + seededRandom(seed + 1) * 35;
    const x = 200 + Math.sin(angle) * dist;
    const y = 370 - Math.cos(angle) * dist;
    const exit_velo = Math.round((98 + seededRandom(seed + 2) * 18) * 10) / 10;
    const launch_angle = Math.round(20 + seededRandom(seed + 3) * 18);
    const distance = Math.round(370 + seededRandom(seed + 4) * 90);
    dots.push({ player_name: playerName, player_id: playerId, manager, x, y, hr_number: i + 1, exit_velo, launch_angle, distance });
  }
  return dots;
}

export default function HRMap({ data }: Props) {
  const managers = [...new Set(data.teams.map((t) => t.manager))].sort();
  const [selectedManager, setSelectedManager] = useState(managers[0] || '');
  const [hoveredDot, setHoveredDot] = useState<HRDot | null>(null);

  const teamPlayers = useMemo(() => {
    const team = data.teams.find((t) => t.manager === selectedManager);
    return team?.players ?? [];
  }, [data, selectedManager]);

  const dots = useMemo(() => {
    const allDots: HRDot[] = [];
    for (const player of teamPlayers) {
      if (player.hr_total > 0) {
        allDots.push(...generateHRPositions(player.player_id, player.player_name, player.manager ?? '', player.hr_total));
      }
    }
    return allDots;
  }, [teamPlayers]);

  const totalHR = teamPlayers.reduce((s, p) => s + p.hr_total, 0);

  const playerColors = useMemo(() => {
    const colors = ['#f59e0b', '#3b82f6', '#10b981', '#a855f7', '#ef4444', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#eab308'];
    const map = new Map<number, string>();
    teamPlayers.filter((p) => p.hr_total > 0).forEach((p, i) => {
      map.set(p.player_id, colors[i % colors.length]);
    });
    return map;
  }, [teamPlayers]);

  return (
    <div className="bg-dinger-card border border-dinger-border rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-dinger-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏟️</span>
          <h3 className="font-display text-xl text-dinger-text-bright tracking-tight">
            HR SPRAY CHART
          </h3>
        </div>
        <select
          value={selectedManager}
          onChange={(e) => { setSelectedManager(e.target.value); setHoveredDot(null); }}
          className="admin-input text-sm"
        >
          {managers.map((m) => (<option key={m} value={m}>{m}</option>))}
        </select>
      </div>

      <div className="p-4 sm:p-6">
        <div className="relative max-w-lg mx-auto">
          <svg viewBox="0 0 400 400" className="w-full" style={{ maxHeight: '460px' }}>
            <defs>
              {/* Stadium background gradient */}
              <radialGradient id="standsGrad" cx="50%" cy="92%" r="55%">
                <stop offset="0%" stopColor="#2a1a0a" />
                <stop offset="60%" stopColor="#1a1018" />
                <stop offset="100%" stopColor="#0f0a14" />
              </radialGradient>
              {/* Grass gradient */}
              <radialGradient id="grassGrad" cx="50%" cy="95%" r="45%">
                <stop offset="0%" stopColor="#1e4a1e" />
                <stop offset="50%" stopColor="#1a3e1a" />
                <stop offset="100%" stopColor="#143214" />
              </radialGradient>
              {/* Dirt gradient */}
              <radialGradient id="dirtGrad2" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#4a3520" />
                <stop offset="100%" stopColor="#3a2a18" />
              </radialGradient>
              {/* Glow filter for HR dots */}
              <filter id="hrGlow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* === STANDS / SEATING AREA === */}
            <path d="M 5 370 Q 200 -30 395 370 Z" fill="url(#standsGrad)" />
            {/* Seat rows (concentric arcs) */}
            {[170, 178, 186].map((r, i) => (
              <path
                key={i}
                d={`M ${200 - r * 0.97} ${370 - r * 0.25} Q 200 ${370 - r} ${200 + r * 0.97} ${370 - r * 0.25}`}
                fill="none"
                stroke="#3a2a3a"
                strokeWidth="0.5"
                opacity="0.4"
              />
            ))}

            {/* === OUTFIELD FENCE / WALL === */}
            <path
              d="M 55 365 Q 200 80 345 365"
              fill="none"
              stroke="#556B2F"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Fence padding/top */}
            <path
              d="M 55 365 Q 200 80 345 365"
              fill="none"
              stroke="#6B8E23"
              strokeWidth="1.5"
              strokeDasharray="0"
              opacity="0.6"
            />

            {/* === WARNING TRACK === */}
            <path d="M 62 363 Q 200 90 338 363 L 345 365 Q 200 80 55 365 Z" fill="#4a3a20" opacity="0.3" />

            {/* === OUTFIELD GRASS === */}
            <path d="M 62 363 Q 200 90 338 363 Z" fill="url(#grassGrad)" />

            {/* Mowing lines */}
            {[-30, -15, 0, 15, 30].map((deg, i) => {
              const rad = (deg * Math.PI) / 180;
              const x2 = 200 + Math.sin(rad) * 140;
              const y2 = 370 - Math.cos(rad) * 140;
              return (
                <line key={i} x1="200" y1="370" x2={x2} y2={y2}
                  stroke={i % 2 === 0 ? '#1f5a1f' : '#1a4a1a'} strokeWidth="12" opacity="0.15" />
              );
            })}

            {/* === INFIELD === */}
            {/* Dirt circle */}
            <circle cx="200" cy="325" r="50" fill="url(#dirtGrad2)" opacity="0.5" />
            {/* Grass cutout in middle */}
            <circle cx="200" cy="318" r="22" fill="#1a3e1a" opacity="0.7" />

            {/* Diamond lines */}
            <polygon points="200,280 240,325 200,370 160,325" fill="none" stroke="#8a7a5a" strokeWidth="1" opacity="0.6" />

            {/* Baselines to outfield */}
            <line x1="200" y1="370" x2="55" y2="225" stroke="#8a7a5a" strokeWidth="0.7" opacity="0.35" />
            <line x1="200" y1="370" x2="345" y2="225" stroke="#8a7a5a" strokeWidth="0.7" opacity="0.35" />

            {/* Bases */}
            <rect x="237" y="322" width="7" height="7" fill="white" opacity="0.85" transform="rotate(45 240.5 325.5)" />
            <rect x="197" y="277" width="7" height="7" fill="white" opacity="0.85" transform="rotate(45 200.5 280.5)" />
            <rect x="157" y="322" width="7" height="7" fill="white" opacity="0.85" transform="rotate(45 160.5 325.5)" />

            {/* Home plate */}
            <polygon points="200,370 196,366 196,362 204,362 204,366" fill="white" opacity="0.9" />

            {/* Pitcher mound */}
            <circle cx="200" cy="328" r="4" fill="#5a4530" opacity="0.6" />
            <circle cx="200" cy="328" r="1.5" fill="white" opacity="0.5" />

            {/* Batter boxes */}
            <rect x="186" y="363" width="8" height="14" fill="none" stroke="white" strokeWidth="0.5" opacity="0.3" rx="1" />
            <rect x="206" y="363" width="8" height="14" fill="none" stroke="white" strokeWidth="0.5" opacity="0.3" rx="1" />

            {/* === HR DOTS (in the stands!) === */}
            {dots.map((dot) => {
              const color = playerColors.get(dot.player_id) || '#f59e0b';
              const isHovered = hoveredDot === dot;
              return (
                <g key={`${dot.player_id}-${dot.hr_number}`}>
                  {/* Landing explosion */}
                  <circle cx={dot.x} cy={dot.y} r={isHovered ? 18 : 9}
                    fill={color} opacity={isHovered ? 0.25 : 0.1}
                    className="transition-all duration-300" />
                  {/* Main dot */}
                  <circle cx={dot.x} cy={dot.y} r={isHovered ? 8 : 5}
                    fill={color} stroke="white" strokeWidth="1.2"
                    filter={isHovered ? 'url(#hrGlow)' : undefined}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setHoveredDot(dot)}
                    onMouseLeave={() => setHoveredDot(null)}
                    onClick={() => setHoveredDot(isHovered ? null : dot)}
                  />
                  {/* Trail line from plate to landing */}
                  {isHovered && (
                    <line x1="200" y1="370" x2={dot.x} y2={dot.y}
                      stroke={color} strokeWidth="1" opacity="0.3"
                      strokeDasharray="4 3" />
                  )}
                </g>
              );
            })}

            {/* Empty state */}
            {dots.length === 0 && (
              <text x="200" y="220" textAnchor="middle" fill="#6b7280" fontSize="13" fontFamily="monospace">
                No home runs yet
              </text>
            )}
          </svg>

          {/* Tooltip */}
          {hoveredDot && (
            <div className="absolute top-4 left-4 bg-dinger-bg border border-dinger-border rounded-xl p-3.5 shadow-2xl max-w-[230px] pointer-events-none z-10"
              style={{ boxShadow: `0 0 20px ${playerColors.get(hoveredDot.player_id) || '#f59e0b'}22` }}>
              <div className="flex items-center gap-2.5 mb-2.5">
                <PlayerHeadshot playerId={hoveredDot.player_id} playerName={hoveredDot.player_name} size="md" />
                <div>
                  <p className="font-body font-bold text-sm text-dinger-text-bright leading-tight">
                    {hoveredDot.player_name}
                  </p>
                  <p className="text-xs text-dinger-muted">
                    Home Run #{hoveredDot.hr_number}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-dinger-border/50">
                <div className="text-center">
                  <p className="font-mono font-bold text-sm text-dinger-accent">{hoveredDot.exit_velo}</p>
                  <p className="text-[10px] text-dinger-muted uppercase">mph</p>
                </div>
                <div className="text-center">
                  <p className="font-mono font-bold text-sm text-dinger-text-bright">{hoveredDot.launch_angle}°</p>
                  <p className="text-[10px] text-dinger-muted uppercase">angle</p>
                </div>
                <div className="text-center">
                  <p className="font-mono font-bold text-sm text-dinger-text-bright">{hoveredDot.distance}&apos;</p>
                  <p className="text-[10px] text-dinger-muted uppercase">feet</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Player legend */}
        {dots.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
            {teamPlayers.filter((p) => p.hr_total > 0).map((p) => (
              <span key={p.player_id} className="flex items-center gap-1.5 text-xs font-mono text-dinger-muted">
                <span className="w-3 h-3 rounded-full inline-block border border-white/20"
                  style={{ backgroundColor: playerColors.get(p.player_id) }} />
                {p.player_name.split(' ').pop()} ({p.hr_total})
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-4 mt-3 text-xs font-mono text-dinger-muted">
          <span>{totalHR} dinger{totalHR !== 1 ? 's' : ''} mapped</span>
          {dots.length > 0 && <span>Hover for details</span>}
        </div>
      </div>
    </div>
  );
}
