export function EmptyState({ title, action }: { title: string; action?: React.ReactNode }) {
  return (<div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
    <p className="text-sm text-neutral-600">{title}</p>{action}</div>);
}
