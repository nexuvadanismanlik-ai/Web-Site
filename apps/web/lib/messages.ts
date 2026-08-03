import { promises as fs } from 'fs';
import path from 'path';
import type { ContactMessage } from '@nexuva/types';

const MESSAGES_PATH = path.join(process.cwd(), '..', '..', 'content', 'messages.json');

export async function readMessages(): Promise<ContactMessage[]> {
  try {
    const raw = await fs.readFile(MESSAGES_PATH, 'utf-8');
    return JSON.parse(raw) as ContactMessage[];
  } catch {
    return [];
  }
}

export async function addMessage(msg: ContactMessage): Promise<void> {
  const list = await readMessages();
  list.unshift(msg);
  await fs.writeFile(MESSAGES_PATH, JSON.stringify(list, null, 2), 'utf-8');
}
