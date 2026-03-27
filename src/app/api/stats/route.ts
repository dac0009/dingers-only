import { NextResponse } from 'next/server';
import { getLeagueData } from '@/lib/mlb-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const season = parseInt(searchParams.get('season') || '2026', 10);

  try {
    const data = await getLeagueData(season);
    return NextResponse.json(data);
  } catch (err) {
    console.error('Stats API error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
