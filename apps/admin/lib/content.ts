import { promises as fs } from 'fs';
import path from 'path';
import type { SiteContent, ContactMessage } from '@nexuva/types';

const CONTENT_PATH = path.join(process.cwd(), '..', '..', 'content', 'site.json');
const MESSAGES_PATH = path.join(process.cwd(), '..', '..', 'content', 'messages.json');

export async function readSiteContent(): Promise<SiteContent> {
  const raw = await fs.readFile(CONTENT_PATH, 'utf-8');
  return JSON.parse(raw) as SiteContent;
}

export async function writeSiteContent(content: SiteContent): Promise<void> {
  await fs.writeFile(CONTENT_PATH, JSON.stringify(content, null, 2), 'utf-8');
}

export async function readMessages(): Promise<ContactMessage[]> {
  try {
    const raw = await fs.readFile(MESSAGES_PATH, 'utf-8');
    return JSON.parse(raw) as ContactMessage[];
  } catch {
    return [];
  }
}

export async function writeMessages(list: ContactMessage[]): Promise<void> {
  await fs.writeFile(MESSAGES_PATH, JSON.stringify(list, null, 2), 'utf-8');
}
