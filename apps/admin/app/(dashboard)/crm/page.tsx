import { getLeadSummary, getLeads, getPipeline } from '../../actions';
import { CrmBoard } from '../../../components/editors/crm-board';
import { CrmSummary } from '../../../components/editors/crm-summary';

export const dynamic = 'force-dynamic';

export default async function CrmPage() {
  // Together, so a cold API is woken once rather than three times.
  const [{ counts, assignees }, leads, summary] = await Promise.all([
    getPipeline(),
    getLeads({}),
    getLeadSummary(),
  ]);

  return (
    <>
      <CrmSummary summary={summary} />
      <CrmBoard leads={leads.items} counts={counts} assignees={assignees} />
    </>
  );
}
