import fs from 'fs';
import path from 'path';
import { RosterEntry, TransactionLog } from './types';

const ROSTER_PATH = path.join(process.cwd(), 'data', 'rosters.csv');
const TRANSACTIONS_PATH = path.join(process.cwd(), 'data', 'transactions.json');

const GITHUB_OWNER = 'dac0009';
const GITHUB_REPO = 'dingers-only';

async function githubGetFile(filePath: string): Promise<{ content: string; sha: string }> {
  const token = process.env.GITHUB_TOKEN || '';
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
    { headers: { Authorization: `token ${token}`, 'User-Agent': 'DingersOnly/1.0' }, cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { content, sha: data.sha };
}

async function githubUpdateFile(filePath: string, content: string, message: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN || '';
  const { sha } = await githubGetFile(filePath);
  const encoded = Buffer.from(content).toString('base64');
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: { Authorization: `token ${token}`, 'User-Agent': 'DingersOnly/1.0', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, content: encoded, sha }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT failed: ${res.status} ${err}`);
  }
}

export function readRoster(): RosterEntry[] {
  const raw = fs.readFileSync(ROSTER_PATH, 'utf-8');
  return parseRosterCSV(raw);
}

function parseRosterCSV(raw: string): RosterEntry[] {
  const lines = raw.trim().split('\n').slice(1);
  return lines.map((line) => {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { parts.push(current.trim()); current = ''; }
      else { current += char; }
    }
    parts.push(current.trim());
    return { manager: parts[0], player_id: parseInt(parts[1], 10), player_roster: parts[2] };
  });
}

function rosterToCSV(entries: RosterEntry[]): string {
  const header = 'manager,player_id,player_roster';
  const lines = entries.map((e) => {
    const mgr = e.manager.includes(',') ? `"${e.manager}"` : e.manager;
    const name = e.player_roster.includes(',') ? `"${e.player_roster}"` : e.player_roster;
    return `${mgr},${e.player_id},${name}`;
  });
  return [header, ...lines].join('\n') + '\n';
}

export async function addPlayer(manager: string, playerId: number, playerName: string): Promise<{ success: boolean; error?: string }> {
  const { content: raw } = await githubGetFile('data/rosters.csv');
  const roster = parseRosterCSV(raw);
  const existing = roster.find((r) => r.player_id === playerId);
  if (existing) return { success: false, error: `Player already on ${existing.manager}'s team` };
  roster.push({ manager, player_id: playerId, player_roster: playerName });
  await githubUpdateFile('data/rosters.csv', rosterToCSV(roster), `Add ${playerName} to ${manager}`);
  await logTransaction({ manager, type: 'add', playerAdded: { id: playerId, name: playerName } });
  return { success: true };
}

export async function dropPlayer(manager: string, playerId: number): Promise<{ success: boolean; error?: string }> {
  const { content: raw } = await githubGetFile('data/rosters.csv');
  const roster = parseRosterCSV(raw);
  const idx = roster.findIndex((r) => r.player_id === playerId && r.manager === manager);
  if (idx === -1) return { success: false, error: 'Player not found on this team' };
  const dropped = roster.splice(idx, 1)[0];
  await githubUpdateFile('data/rosters.csv', rosterToCSV(roster), `Drop ${dropped.player_roster} from ${manager}`);
  await logTransaction({ manager, type: 'drop', playerDropped: { id: dropped.player_id, name: dropped.player_roster } });
  return { success: true };
}

export async function swapPlayer(manager: string, dropPlayerId: number, addPlayerId: number, addPlayerName: string): Promise<{ success: boolean; error?: string }> {
  const { content: raw } = await githubGetFile('data/rosters.csv');
  const roster = parseRosterCSV(raw);
  const dropIdx = roster.findIndex((r) => r.player_id === dropPlayerId && r.manager === manager);
  if (dropIdx === -1) return { success: false, error: 'Player to drop not found on this team' };
  const existingAdd = roster.find((r) => r.player_id === addPlayerId);
  if (existingAdd) return { success: false, error: `Player to add is already on ${existingAdd.manager}'s team` };
  const dropped = roster[dropIdx];
  roster[dropIdx] = { manager, player_id: addPlayerId, player_roster: addPlayerName };
  await githubUpdateFile('data/rosters.csv', rosterToCSV(roster), `Swap: ${dropped.player_roster} -> ${addPlayerName} (${manager})`);
  await logTransaction({ manager, type: 'swap', playerAdded: { id: addPlayerId, name: addPlayerName }, playerDropped: { id: dropped.player_id, name: dropped.player_roster } });
  return { success: true };
}

async function logTransaction(tx: Omit<TransactionLog, 'id' | 'timestamp'>): Promise<void> {
  let transactions: TransactionLog[] = [];
  try {
    const { content: raw } = await githubGetFile('data/transactions.json');
    transactions = JSON.parse(raw);
  } catch { transactions = []; }
  transactions.unshift({ ...tx, id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, timestamp: new Date().toISOString() });
  transactions = transactions.slice(0, 200);
  await githubUpdateFile('data/transactions.json', JSON.stringify(transactions, null, 2), `Transaction: ${tx.type} by ${tx.manager}`);
}

export function getTransactions(): TransactionLog[] {
  if (!fs.existsSync(TRANSACTIONS_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(TRANSACTIONS_PATH, 'utf-8')); } catch { return []; }
}

export function getManagers(): string[] {
  const roster = readRoster();
  return [...new Set(roster.map((r) => r.manager))].sort();
}
