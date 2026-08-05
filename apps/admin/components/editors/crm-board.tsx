'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, Plus, RefreshCw, UserX } from 'lucide-react';
import { EmptyState, SearchBar, SelectField, useToast } from '@nexuva/ui';
import { setLeadStatus } from '../../app/actions';
import {
  LEAD_STATUSES,
  personName,
  type Lead,
  type LeadPerson,
  type LeadStatus,
} from '../../lib/model';
import { LeadDrawer } from './lead-drawer';
import { NewLeadDialog } from './new-lead-dialog';
import { STATUS_ACCENT, STATUS_LABELS } from './pipeline-status';

function shortWhen(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
}

/**
 * The pipeline.
 *
 * Cards are dragged between columns with the browser's own drag-and-drop rather
 * than a library: the frozen architecture rules out adding one, and moving a
 * card between nine columns is exactly what the native API is for. The drop
 * writes through to the server and the board is refreshed from the response.
 *
 * A card is also openable, because dragging is not available to everyone —
 * the drawer carries the same status control.
 */
export function CrmBoard({
  leads,
  counts,
  assignees,
  services,
  budgets,
}: {
  leads: Lead[];
  counts: Record<LeadStatus, number>;
  assignees: LeadPerson[];
  /** Service names offered by the site, for the new-lead form. */
  services: string[];
  /** Budget bands, shared with the public form. */
  budgets: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [search, setSearch] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<LeadStatus | null>(null);

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('tr');
    return leads.filter((lead) => {
      if (assignedFilter === 'none' && lead.assignedTo) return false;
      if (assignedFilter && assignedFilter !== 'none' && lead.assignedTo?.id !== assignedFilter) {
        return false;
      }
      if (!needle) return true;
      return [lead.name, lead.company, lead.email, lead.subject, lead.service]
        .filter(Boolean)
        .some((field) => String(field).toLocaleLowerCase('tr').includes(needle));
    });
  }, [leads, search, assignedFilter]);

  const byStatus = useMemo(() => {
    const grouped = {} as Record<LeadStatus, Lead[]>;
    for (const status of LEAD_STATUSES) grouped[status] = [];
    for (const lead of visible) grouped[lead.status]?.push(lead);
    return grouped;
  }, [visible]);

  const unassigned = visible.filter((lead) => !lead.assignedTo).length;

  function move(leadId: string, status: LeadStatus) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === status) return;

    startTransition(async () => {
      const result = await setLeadStatus(leadId, status);
      if (!result.ok) {
        toast.error(result.error ?? 'Durum değiştirilemedi.');
        return;
      }
      toast.success(`${lead.name} → ${STATUS_LABELS[status]}`);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold text-fg">Talep Yönetimi</h1>
          <p className="mt-0.5 text-sm text-muted">
            {visible.length} talep
            {unassigned > 0 && (
              <>
                {' · '}
                <button
                  onClick={() => setAssignedFilter(assignedFilter === 'none' ? '' : 'none')}
                  className={`inline-flex items-center gap-1 ${
                    assignedFilter === 'none' ? 'text-amber-500' : 'text-amber-500/80 hover:text-amber-500'
                  }`}
                >
                  <UserX className="h-3.5 w-3.5" />
                  {unassigned} atanmamış
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.refresh()}
            disabled={pending}
            className="ui-button text-xs"
            aria-label="Listeyi yenile"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
            Yenile
          </button>
          <button onClick={() => setCreating(true)} className="ui-button-primary text-xs">
            <Plus className="h-3.5 w-3.5" />
            Yeni Talep
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="İsim, firma, e-posta, hizmet..." />
        <div className="w-52">
          <SelectField
            label="Atanan"
            value={assignedFilter}
            onChange={setAssignedFilter}
            options={[
              { value: '', label: 'Herkes' },
              { value: 'none', label: 'Atanmamış' },
              ...assignees.map((p) => ({ value: p.id, label: personName(p) })),
            ]}
          />
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="ui-panel">
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="Henüz talep yok"
            hint="Sitedeki iletişim formundan gelen talepler burada bir hattı takip eder. Telefonla gelen bir talebi kendin de ekleyebilirsin."
            action={
              <button onClick={() => setCreating(true)} className="ui-button-primary text-xs">
                <Plus className="h-3.5 w-3.5" />
                Yeni Talep
              </button>
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-max gap-3">
            {LEAD_STATUSES.map((status) => {
              const items = byStatus[status];
              return (
                <div
                  key={status}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(status);
                  }}
                  onDragLeave={() => setOver((s) => (s === status ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOver(null);
                    const id = e.dataTransfer.getData('text/plain') || dragging;
                    setDragging(null);
                    if (id) move(id, status);
                  }}
                  className={`w-64 shrink-0 rounded-2xl border-t-2 bg-overlay/[0.03] p-2 transition-colors ${
                    STATUS_ACCENT[status]
                  } ${over === status ? 'bg-overlay/10' : ''}`}
                >
                  <div className="mb-2 flex items-center justify-between px-1.5 py-1">
                    <span className="text-xs font-semibold text-fg">{STATUS_LABELS[status]}</span>
                    <span className="rounded-full bg-overlay/10 px-2 py-0.5 text-[11px] text-muted">
                      {counts[status] ?? items.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {items.map((lead) => (
                      <article
                        key={lead.id}
                        draggable={!pending}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', lead.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDragging(lead.id);
                        }}
                        onDragEnd={() => setDragging(null)}
                        className={`ui-panel cursor-grab p-3 active:cursor-grabbing ${
                          dragging === lead.id ? 'opacity-50' : ''
                        }`}
                      >
                        <button
                          onClick={() => setOpenId(lead.id)}
                          className="w-full text-left"
                          aria-label={`${lead.name} talebini aç`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="truncate text-sm font-medium text-fg">{lead.name}</span>
                            {!lead.isRead && (
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                            )}
                          </div>
                          {lead.company && (
                            <div className="truncate text-xs text-muted">{lead.company}</div>
                          )}
                          {lead.service && (
                            <div className="mt-1 truncate text-[11px] text-faint">{lead.service}</div>
                          )}

                          {lead.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {lead.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-overlay/10 px-1.5 py-0.5 text-[10px] text-muted"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
                            <span>#{lead.requestNo}</span>
                            <span>
                              {lead.assignedTo ? personName(lead.assignedTo) : 'atanmamış'} ·{' '}
                              {shortWhen(lead.lastActionAt)}
                            </span>
                          </div>
                        </button>
                      </article>
                    ))}

                    {items.length === 0 && (
                      <p className="px-1.5 py-6 text-center text-[11px] text-faint">
                        {over === status ? 'Buraya bırak' : '—'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {openId && (
        <LeadDrawer
          leadId={openId}
          assignees={assignees}
          onClose={() => setOpenId(null)}
          onChanged={() => router.refresh()}
        />
      )}

      {creating && (
        <NewLeadDialog
          assignees={assignees}
          services={services}
          budgets={budgets}
          onClose={() => setCreating(false)}
          onCreated={() => router.refresh()}
        />
      )}
    </div>
  );
}
