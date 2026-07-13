import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  paid: "border-emerald-700 bg-emerald-50 text-emerald-800 before:bg-emerald-600",
  delivered: "border-emerald-700 bg-emerald-50 text-emerald-800 before:bg-emerald-600",
  shipped: "border-sky-700 bg-sky-50 text-sky-800 before:bg-sky-600",
  processing: "border-blue-700 bg-blue-50 text-blue-800 before:bg-blue-600",
  new: "border-amber-700 bg-amber-50 text-amber-800 before:bg-amber-500",
  pending: "border-amber-700 bg-amber-50 text-amber-800 before:bg-amber-500",
  failed: "border-red-700 bg-red-50 text-red-800 before:bg-red-600",
  cancelled: "border-red-700 bg-red-50 text-red-800 before:bg-red-600",
  refunded: "border-violet-700 bg-violet-50 text-violet-800 before:bg-violet-600",
  generated: "border-emerald-700 bg-emerald-50 text-emerald-800 before:bg-emerald-600",
  not_generated: "border-slate-700 bg-slate-50 text-slate-800 before:bg-slate-500",
  private: "border-slate-800 bg-slate-100 text-slate-900 before:bg-slate-700",
  scheduled: "border-amber-700 bg-amber-50 text-amber-800 before:bg-amber-500",
  published: "border-emerald-700 bg-emerald-50 text-emerald-800 before:bg-emerald-600",
  bank_transfer: "border-slate-700 bg-slate-50 text-slate-800 before:bg-slate-500",
  card: "border-slate-700 bg-slate-50 text-slate-800 before:bg-slate-500",
};

type StatusBadgeProps = {
  value: string;
  className?: string;
};

export function StatusBadge({ value, className }: StatusBadgeProps) {
  const normalizedValue = value.toLowerCase();
  const firstToken = normalizedValue.split(/\s+/)[0] ?? normalizedValue;
  const statusClass =
    STATUS_STYLES[normalizedValue] ??
    STATUS_STYLES[firstToken] ??
    "border-slate-700 bg-white text-slate-800 before:bg-slate-500";

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-2 border px-3 py-2 text-xs font-black uppercase tracking-widest before:size-2 before:shrink-0 before:rounded-full before:content-['']",
        statusClass,
        className,
      )}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}
