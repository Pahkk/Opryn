export default function ConnectionsLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading connections"
      className="space-y-8"
    >
      <h1 className="opryn-page-title">Connections</h1>
      <p className="text-[var(--opryn-muted)]">
        Loading your company’s connections…
      </p>
      <div aria-hidden="true" className="space-y-4">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="h-20 rounded-xl bg-[#e8ece6]" />
        ))}
      </div>
    </section>
  );
}
