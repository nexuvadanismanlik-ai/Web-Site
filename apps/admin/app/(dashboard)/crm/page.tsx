import { getLeads, getPipeline } from '../../actions';
import { CrmBoard } from '../../../components/editors/crm-board';

export const dynamic = 'force-dynamic';

export default async function CrmPage() {
  // Together, so a cold API is woken once rather than twice.
  const [{ counts, assignees }, leads] = await Promise.all([getPipeline(), getLeads({})]);
  return <CrmBoard leads={leads.items} counts={counts} assignees={assignees} />;
}
