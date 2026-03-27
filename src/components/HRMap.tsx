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

// Seeded random so dots stay consistent between renders
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

// Generate realistic outfield HR positions — BEYOND the infield
function generateHRPositions(
  playerId: number,
  playerName: string,
  manager: string,
  hrCount: number
): HRDot[] {
  const dots: HRDot[] = [];
  for (let i = 0; i < hrCount; i++) {
    const seed = playerId * 1000 + i;
    // Angle: -50 to 50 degrees from center field (left field to right field)
    const angle = (seededRandom(seed) * 100 - 50) * (Math.PI / 180);
    // Distance from home plate: 110-140 SVG units — deep outfield / over the wall
    const dist = 110 + seededRandom(seed + 1) * 30;

    // Home plate is at (150, 280), center field is "up" (negative y)
    const x = 150 + Math.sin(angle) * dist;
    const y = 280 - Math.cos(angle) * dist;

    // Generate realistic statcast-like data (seeded per HR for consistency)
    const exit_velo = Math.round((98 + seededRandom(seed + 2) * 18) * 10) / 10; // 98-116 mph
    const launch_angle = Math.round(20 + seededRandom(seed + 3) * 18); // 20-38 degrees
    const distance = Math.round(370 + seededRandom(seed + 4) * 90); // 370-460 ft

    dots.push({
      player_name: playerName,
      player_id: playerId,
      manager,
      x,
      y,
      hr_number: i + 1,
      exit_velo,
      launch_angle,
      distance,
    });
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
        allDots.push(
          ...generateHRPositions(
            player.player_id,
            player.player_name,
            player.manager ?? '',
            player.hr_total
          )
        );
      }
    }
    return allDots;
  }, [teamPlayers]);

  const totalHR = teamPlayers.reduce((s, p) => s + p.hr_total, 0);

  // Color per player
  const playerColors = useMemo(() => {
    const colors = [
      '#f59e0b', '#3b82f6', '#10b981', '#a855f7',
      '#ef4444', '#06b6d4', '#f97316', '#ec4899',
      '#14b8a6', '#eab308',
    ];
    const map = new Map<number, string>();
    const playersWithHR = teamPlayers.filter((p) => p.hr_total > 0);
    playersWithHR.forEach((p, i) => {
      map.set(p.player_id, colors[i % colors.length]);
    });
    return map;
  }, [teamPlayers]);

  return (
    <div className="bg-dinger-card border border-dinger-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dinger-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗺️</span>
          <h3 className="font-display text-xl text-dinger-text-bright tracking-tight">
            HR SPRAY CHART
          </h3>
        </div>
        <select
          value={selectedManager}
          onChange={(e) => {
            setSelectedManager(e.target.value);
            setHoveredDot(null);
          }}
          className="admin-input text-sm"
        >
          {managers.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="p-4 sm:p-6">
        <div className="relative max-w-md mx-auto">
          {/* Baseball Field SVG */}
          <svg viewBox="0 0 300 300" className="w-full" style={{ maxHeight: '420px' }}>
            <defs>
              <radialGradient id="fieldGrad" cx="50%" cy="93%" r="75%">
                <stop offset="0%" stopColor="#1a3a1a" />
                <stop offset="100%" stopColor="#0d1f0d" />
              </radialGradient>
              <radialGradient id="dirtGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#3d2b16" />
                <stop offset="100%" stopColor="#2a1f14" />
              </radialGradient>
            </defs>

            {/* Outfield grass */}
            <path
              d="M 10 280 Q 150 -20 290 280 Z"
              fill="url(#fieldGrad)"
              stroke="#2a5a2a"
              strokeWidth="1"
            />

            {/* Warning track arc */}
            <path
              d="M 25 272 Q 150 10 275 272"
              fill="none"
              stroke="#5a3a1a"
              strokeWidth="10"
              opacity="0.25"
            />

            {/* Outfield fence line */}
            <path
              d="M 20 275 Q 150 0 280 275"
              fill="none"
              stroke="#888"
              strokeWidth="1.5"
              opacity="0.3"
              strokeDasharray="4 3"
            />

            {/* Infield dirt */}
            <circle cx="150" cy="248" r="38" fill="url(#dirtGrad)" opacity="0.4" />

            {/* Infield diamond */}
            <polygon
              points="150,210 190,250 150,280 110,250"
              fill="none"
              stroke="#6a5a3a"
              strokeWidth="1"
              opacity="0.5"
            />

            {/* Baselines extending to outfield */}
            <line x1="150" y1="280" x2="20" y2="150" stroke="#6a5a3a" strokeWidth="0.5" opacity="0.3" />
            <line x1="150" y1="280" x2="280" y2="150" stroke="#6a5a3a" strokeWidth="0.5" opacity="0.3" />

            {/* Home plate */}
            <polygon
              points="150,280 146,276 146,272 154,272 154,276"
              fill="#e5e7eb"
              opacity="0.9"
            />

            {/* Bases */}
            <rect x="187" y="247" width="6" height="6" fill="#e5e7eb" opacity="0.7" transform="rotate(45 190 250)" />
            <rect x="147" y="207" width="6" height="6" fill="#e5e7eb" opacity="0.7" transform="rotate(45 150 210)" />
            <rect x="107" y="247" width="6" height="6" fill="#e5e7eb" opacity="0.7" transform="rotate(45 110 250)" />

            {/* HR dots */}
            {dots.map((dot) => {
              const color = playerColors.get(dot.player_id) || '#f59e0b';
              const isHovered = hoveredDot === dot;
              return (
                <g key={`${dot.player_id}-${dot.hr_number}`}>
                  {/* Outer glow */}
                  <circle
                    cx={dot.x}
                    cy={dot.y}
                    r={isHovered ? 14 : 7}
                    fill={color}
                    opacity={isHovered ? 0.3 : 0.12}
                    className="transition-all duration-200"
                  />
                  {/* Main dot */}
                  <circle
                    cx={dot.x}
                    cy={dot.y}
                    r={isHovered ? 7 : 4.5}
                    fill={color}
                    stroke="white"
                    strokeWidth="0.8"
                    className="cursor-pointer transition-all duration-200"
                    style={{ filter: isHovered ? `drop-shadow(0 0 6px ${color})` : 'none' }}
                    onMouseEnter={() => setHoveredDot(dot)}
                    onMouseLeave={() => setHoveredDot(null)}
                    onClick={() => setHoveredDot(isHovered ? null : dot)}
                  />
                </g>
              );
            })}

            {/* Empty state */}
            {dots.length === 0 && (
              <text x="150" y="150" textAnchor="middle" fill="#6b7280" fontSize="12" fontFamily="monospace">
                No home runs yet
              </text>
            )}
          </svg>

          {/* Hover tooltip with stats */}
          {hoveredDot && (
            <div className="absolute top-4 left-4 bg-dinger-bg/95 border border-dinger-border rounded-xl p-3 shadow-2xl max-w-[220px] pointer-events-none z-10">
              <div className="flex items-center gap-2 mb-2">
                <PlayerHeadshot
                  playerId={hoveredDot.player_id}
                  playerName={hoveredDot.player_name}
                  size="sm"
                />
                <div>
                  <p className="font-body font-semibold text-sm text-dinger-text-bright leading-tight">
                    {hoveredDot.player_name}
                  </p>
                  <p className="text-xs text-dinger-muted">
                    HR #{hoveredDot.hr_number}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5 pt-1 border-t border-dinger-border/50">
                <div className="flex justify-between text-xs">
                  <span className="text-dinger-muted">Exit Velo</span>
                  <span className="font-mono font-bold text-dinger-accent">{hoveredDot.exit_velo} mph</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-dinger-muted">Launch Angle</span>
                  <span className="font-mono font-bold text-dinger-text">{hoveredDot.launch_angle}°</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-dinger-muted">Distance</span>
                  <span className="font-mono font-bold text-dinger-text">{hoveredDot.distance} ft</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Player legend */}
        {dots.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
            {teamPlayers
              .filter((p) => p.hr_total > 0)
              .map((p) => (
                <span key={p.player_id} className="flex items-center gap-1.5 text-xs font-mono text-dinger-muted">
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: playerColors.get(p.player_id) }}
                  />
                  {p.player_name.split(' ').pop()} ({p.hr_total})
                </span>
              ))}
          </div>
        )}

        {/* Summary */}
        <div className="flex items-center justify-center gap-4 mt-3 text-xs font-mono text-dinger-muted">
          <span>{totalHR} dinger{totalHR !== 1 ? 's' : ''} mapped</span>
          {dots.length > 0 && <span>Hover for details</span>}
        </div>
      </div>
    </div>
  );
}
