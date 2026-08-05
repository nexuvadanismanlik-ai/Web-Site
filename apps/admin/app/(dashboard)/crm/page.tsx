import { LEAD_BUDGET_BANDS } from '@nexuva/shared';
import { getLeadSummary, getLeads, getPipeline } from '../../actions';
import { readSiteContent } from '../../../lib/content';
import { CrmBoard } from '../../../components/editors/crm-board';
import { CrmSummary } from '../../../components/editors/crm-summary';

export const dynamic = 'force-dynamic';

export default async function CrmPage() {
  // Together, so a cold API is woken once rather than four times.
  const [{ counts, assignees }, leads, summary, content] = await Promise.all([
    getPipeline(),
    getLeads({}),
    getLeadSummary(),
    readSiteContent(),
  ]);

  // The new-lead form offers the services the company actually sells, read from
  // the site's own content rather than a second list that would drift from it.
  // The site is Turkish; the data model still carries both languages.
  const services = content.services.map((service) => service.title.tr).filter(Boolean);

  return (
    <>
      <CrmSummary summary={summary} />
      <CrmBoard
        leads={leads.items}
        counts={counts}
        assignees={assignees}
        services={services}
        budgets={[...LEAD_BUDGET_BANDS]}
      />
    </>
  );
}
