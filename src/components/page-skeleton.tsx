export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-[93px] border-b border-slate-200 bg-white" />
      <main className="mx-auto w-full max-w-6xl animate-pulse px-4 py-8 sm:px-6 sm:py-10">
        <div className="h-8 w-48 rounded bg-slate-200" />
        <div className="mt-3 h-5 w-full max-w-xl rounded bg-slate-200" />
        <div className="mt-8 h-11 w-full rounded-lg bg-slate-200" />
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {Array.from({ length: rows }, (_, index) => <div key={index} className="flex gap-4 border-b border-slate-100 p-5"><div className="h-5 w-24 rounded bg-slate-200" /><div className="h-5 flex-1 rounded bg-slate-100" /><div className="hidden h-5 w-28 rounded bg-slate-100 sm:block" /></div>)}
        </div>
      </main>
    </div>
  )
}
