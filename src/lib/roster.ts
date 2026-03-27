import fs from 'fs';
import path from 'path';
import { RosterEntry, TransactionLog } from './types';

const ROSTER_PATH = path.join(process.cwd(), 'data', 'rosters.csv');
const TRANSACTIONS_PATH = path.join(process.cwd(), 'data', 'transactions.json');

export function readRoster(): RosterEntry[] {
  const raw = fs.readFileSync(ROSTER_PATH, 'utf-8');
  const lines = raw.trim().split('\n').slice(1); // skip header
  return lines.map((line) => {
    // Handle CSV with quoted fields
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current.trim());

    return {
      manager: parts[0],
      player_id: parseInt(parts[1], 10),
      player_roster: parts[2],
    };
  });
}

export function writeRoster(entries: RosterEntry[]): void {
  const header = 'manager,player_id,player_roster';
  const lines = entries.map((e) => {
    const mgr = e.manager.includes(',') ? `"${e.manager}"` : e.manager;
    const name = e.player_roster.includes(',')
      ? `"${e.player_roster}"`
      : e.player_roster;
    return `${mgr},${e.player_id},${name}`;
  });
  fs.writeFileSync(ROSTER_PATH, [header, ...lines].join('\n') + '\n', 'utf-8');
}

export function addPlayer(
  manager: string,
  playerId: number,
  playerName: string
): { success: boolean; error?: string } {
  const roster = readRoster();

  // Check if player already on a team
  const existing = roster.find((r) => r.player_id === playerId);
  if (existing) {
    return {
      success: false,
      error: `Player already on ${existing.manager}'s team`,
    };
  }

  roster.push({ manager, player_id: playerId, player_roster: playerName });
  writeRoster(roster);
  logTransaction({
    manager,
    type: 'add',
    playerAdded: { id: playerId, name: playerName },
  });
  return { success: true };
}

export function dropPlayer(
  manager: string,
  playerId: number
): { success: boolean; error?: string } {
  const roster = readRoster();
  const idx = roster.findIndex(
    (r) => r.player_id === playerId && r.manager === manager
  );
  if (idx === -1) {
    return { success: false, error: 'Player not found on this team' };
  }

  const dropped = roster.splice(idx, 1)[0];
  writeRoster(roster);
  logTransaction({
    manager,
    type: 'drop',
    playerDropped: { id: dropped.player_id, name: dropped.player_roster },
  });
  return { success: true };
}

export function swapPlayer(
  manager: string,
  dropPlayerId: number,
  addPlayerId: number,
  addPlayerName: string
): { success: boolean; error?: string } {
  const roster = readRoster();

  const dropIdx = roster.findIndex(
    (r) => r.player_id === dropPlayerId && r.manager === manager
  );
  if (dropIdx === -1) {
    return { success: false, error: 'Player to drop not found on this team' };
  }

  const existingAdd = roster.find((r) => r.player_id === addPlayerId);
  if (existingAdd) {
    return {
      success: false,
      error: `Player to add is already on ${existingAdd.manager}'s team`,
    };
  }

  const dropped = roster[dropIdx];
  roster[dropIdx] = {
    manager,
    player_id: addPlayerId,
    player_roster: addPlayerName,
  };
  writeRoster(roster);
  logTransaction({
    manager,
    type: 'swap',
    playerAdded: { id: addPlayerId, name: addPlayerName },
    playerDropped: { id: dropped.player_id, name: dropped.player_roster },
  });
  return { success: true };
}

function logTransaction(
  tx: Omit<TransactionLog, 'id' | 'timestamp'>
): void {
  let transactions: TransactionLog[] = [];
  if (fs.existsSync(TRANSACTIONS_PATH)) {
    try {
      transactions = JSON.parse(
        fs.readFileSync(TRANSACTIONS_PATH, 'utf-8')
      );
    } catch {
      transactions = [];
    }
  }
  transactions.unshift({
    ...tx,
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  });
  // Keep last 200
  transactions = transactions.slice(0, 200);
  fs.writeFileSync(TRANSACTIONS_PATH, JSON.stringify(transactions, null, 2));
}

export function getTransactions(): TransactionLog[] {
  if (!fs.existsSync(TRANSACTIONS_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(TRANSACTIONS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

export function getManagers(): string[] {
  const roster = readRoster();
  return [...new Set(roster.map((r) => r.manager))].sort();
}
