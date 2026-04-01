import { NextResponse } from 'next/server';
import {
  readRoster,
  addPlayer,
  dropPlayer,
  swapPlayer,
  getTransactions,
  getManagers,
} from '@/lib/roster';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'transactions') {
    return NextResponse.json(getTransactions());
  }

  if (action === 'managers') {
    return NextResponse.json(getManagers());
  }

  const roster = readRoster();
  const manager = searchParams.get('manager');
  if (manager) {
    return NextResponse.json(roster.filter((r) => r.manager === manager));
  }
  return NextResponse.json(roster);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, manager, playerId, playerName, dropPlayerId } = body;

    if (!manager) {
      return NextResponse.json({ error: 'Manager is required' }, { status: 400 });
    }

    let result;

    switch (action) {
      case 'add':
        if (!playerId || !playerName) {
          return NextResponse.json({ error: 'playerId and playerName are required' }, { status: 400 });
        }
        result = await addPlayer(manager, playerId, playerName);
        break;

      case 'drop':
        if (!playerId) {
          return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
        }
        result = await dropPlayer(manager, playerId);
        break;

      case 'swap':
        if (!dropPlayerId || !playerId || !playerName) {
          return NextResponse.json({ error: 'dropPlayerId, playerId, and playerName are required' }, { status: 400 });
        }
        result = await swapPlayer(manager, dropPlayerId, playerId, playerName);
        break;

      default:
        return NextResponse.json({ error: 'Invalid action. Use: add, drop, swap' }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Changes saved. Site will update in ~30 seconds.' });
  } catch (err) {
    console.error('Roster API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
