import * as React from "react";
export function Field({ label, error, hint, id, children }: { label: string; error?: string; hint?: string; id: string; children: React.ReactNode }) {
  return (<div className="space-y-1.5">
    <label htmlFor={id} className="text-sm font-medium">{label}</label>
    {children}
    {hint && !error && <p className="text-xs text-neutral-500">{hint}</p>}
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </div>);
}
