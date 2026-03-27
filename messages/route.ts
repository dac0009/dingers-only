import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getManagers } from '@/lib/roster';

export const dynamic = 'force-dynamic';

interface Message {
  id: string;
  manager: string;
  text: string;
  timestamp: string;
}

const MESSAGES_PATH = path.join(process.cwd(), 'data', 'messages.json');

function readMessages(): Message[] {
  if (!fs.existsSync(MESSAGES_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(MESSAGES_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function writeMessages(messages: Message[]): void {
  fs.writeFileSync(MESSAGES_PATH, JSON.stringify(messages, null, 2));
}

export async function GET() {
  const messages = readMessages();
  return NextResponse.json(messages);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { manager, text } = body;

    if (!manager || !text) {
      return NextResponse.json(
        { error: 'manager and text are required' },
        { status: 400 }
      );
    }

    // Validate manager exists
    const managers = getManagers();
    if (!managers.includes(manager)) {
      return NextResponse.json(
        { error: 'Invalid manager name' },
        { status: 400 }
      );
    }

    // Validate text length
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed.length > 280) {
      return NextResponse.json(
        { error: 'Message must be 1-280 characters' },
        { status: 400 }
      );
    }

    const messages = readMessages();
    const newMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      manager,
      text: trimmed,
      timestamp: new Date().toISOString(),
    };

    messages.unshift(newMessage);
    // Keep last 100 messages
    const trimmedMessages = messages.slice(0, 100);
    writeMessages(trimmedMessages);

    return NextResponse.json(newMessage);
  } catch (err) {
    console.error('Message API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
