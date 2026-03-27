'use client';

import { useState } from 'react';

interface Props {
  playerId: number;
  playerName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
};

export default function PlayerHeadshot({
  playerId,
  playerName,
  size = 'md',
  className = '',
}: Props) {
  const [error, setError] = useState(false);
  const url = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${playerId}/headshot/67/current`;

  if (error) {
    return (
      <div
        className={`${sizes[size]} rounded-full bg-dinger-border flex items-center justify-center text-dinger-muted shrink-0 ${className}`}
      >
        <span className="text-xs font-mono">
          {playerName
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={playerName}
      className={`${sizes[size]} rounded-full object-cover bg-dinger-border shrink-0 ${className}`}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}
