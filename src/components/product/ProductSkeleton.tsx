export function ProductSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="bg-slate-100 aspect-square w-full" />
      <div className="space-y-2">
        <div className="h-4 bg-slate-200 w-2/3" />
        <div className="h-4 bg-slate-200 w-1/4" />
      </div>
    </div>
  );
}
