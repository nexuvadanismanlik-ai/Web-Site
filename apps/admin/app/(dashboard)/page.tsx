export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">Nexuva OS — Holding Operating System</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Companies', value: '—' },
          { label: 'Active Products', value: '—' },
          { label: 'Domains', value: '—' },
          { label: 'Users', value: '—' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
          >
            <p className="text-sm text-zinc-500">{stat.label}</p>
            <p className="mt-2 font-heading text-3xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-zinc-500 text-sm">
          Dashboard data — Phase 4 implementation pending. Connect to NestJS API.
        </p>
      </div>
    </div>
  );
}
