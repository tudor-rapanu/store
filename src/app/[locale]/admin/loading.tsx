export default function AdminLoading() {
  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-16">
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-black pb-4">
        <div className="space-y-3">
          <div className="h-10 w-64 animate-pulse bg-slate-100" />
          <div className="h-4 w-80 animate-pulse bg-slate-100" />
        </div>
        <div className="h-10 w-32 animate-pulse bg-slate-100" />
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="grid gap-4 border border-black p-4 md:grid-cols-[1fr_auto] md:items-center"
          >
            <div className="space-y-3">
              <div className="h-5 w-56 animate-pulse bg-slate-100" />
              <div className="h-4 w-80 max-w-full animate-pulse bg-slate-100" />
            </div>
            <div className="h-10 w-28 animate-pulse bg-slate-100" />
          </div>
        ))}
      </div>
    </main>
  );
}
