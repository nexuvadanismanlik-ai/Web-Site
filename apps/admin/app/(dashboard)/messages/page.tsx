import { readMessages } from '../../../lib/content';
import { MessagesClient } from '../../../components/editors/messages-client';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const messages = await readMessages();
  return <MessagesClient messages={messages} />;
}
