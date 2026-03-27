import { NextResponse } from 'next/server';
import { searchPlayers } from '@/lib/mlb-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const season = parseInt(searchParams.get('season') || '2026', 10);

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const results = await searchPlayers(q, season);
  return NextResponse.json(results);
}
