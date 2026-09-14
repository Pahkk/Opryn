export default function AppLoading() {
  return (
    <div className="space-y-7" aria-label="Opening your workspace" aria-busy>
      <div className="space-y-3">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-[#e7ebf1]" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-[#eef1f5]" />
      </div>
      <div className="min-h-[58vh] animate-pulse rounded-[18px] border border-[var(--opryn-line)] bg-white p-7 shadow-[var(--opryn-shadow-sm)]">
        <div className="mx-auto flex max-w-lg flex-col items-center pt-24">
          <div className="h-7 w-64 max-w-full rounded-md bg-[#e8ecf2]" />
          <div className="mt-4 h-4 w-80 max-w-full rounded bg-[#f0f2f6]" />
          <div className="mt-10 h-14 w-full rounded-[13px] bg-[#edf1f6]" />
        </div>
      </div>
    </div>
  );
}
