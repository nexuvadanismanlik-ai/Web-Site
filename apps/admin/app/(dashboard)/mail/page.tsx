import { getMailLogs, getMailSettings, getMailTemplates } from '../../actions';
import { MailCenter } from '../../../components/editors/mail-center';

export const dynamic = 'force-dynamic';

export default async function MailPage() {
  // Together, so a cold API is woken once rather than three times.
  const [settings, templates, logs] = await Promise.all([
    getMailSettings(),
    getMailTemplates(),
    getMailLogs(),
  ]);

  return (
    <MailCenter
      settings={settings}
      templates={templates.templates}
      variables={templates.variables}
      logs={logs.items}
      failedCount={logs.failed}
    />
  );
}
