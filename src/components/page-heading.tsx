type PageHeadingProps = {
  title: string
  description: string
  action?: React.ReactNode
}

export function PageHeading({ title, description, action }: PageHeadingProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
      </div>
      {action}
    </div>
  )
}
