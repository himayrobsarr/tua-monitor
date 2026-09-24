import type { LucideIcon } from 'lucide-react'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <section className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center sm:px-10">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-blue-50 text-blue-700"><Icon className="size-6" aria-hidden="true" /></span>
      <h2 className="mt-4 text-base font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  )
}
