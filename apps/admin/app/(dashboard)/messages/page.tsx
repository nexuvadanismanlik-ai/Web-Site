import { readMessages } from '../../../lib/content';
import { MessagesClient } from '../../../components/editors/messages-client';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const { items, total, unread } = await readMessages();
  return <MessagesClient messages={items} total={total} unread={unread} />;
}
