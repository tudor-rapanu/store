import { ProductSkeleton } from "@/components/product/ProductSkeleton";

export default function LocaleLoading() {
  return (
    <main className="mx-auto min-h-[calc(100vh-10rem)] max-w-7xl px-8 py-16">
      <section className="grid gap-8 border-b border-black pb-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
        <div className="space-y-4">
          <div className="h-12 max-w-3xl animate-pulse bg-slate-100 sm:h-16" />
          <div className="h-12 max-w-2xl animate-pulse bg-slate-100 sm:h-16" />
        </div>
        <div className="space-y-4">
          <div className="h-4 animate-pulse bg-slate-100" />
          <div className="h-4 w-4/5 animate-pulse bg-slate-100" />
          <div className="h-11 w-40 animate-pulse bg-slate-100" />
        </div>
      </section>

      <section className="space-y-6 py-12">
        <div className="flex items-end justify-between gap-4">
          <div className="h-8 w-56 animate-pulse bg-slate-100" />
          <div className="h-10 w-24 animate-pulse bg-slate-100" />
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <ProductSkeleton key={item} />
          ))}
        </div>
      </section>
    </main>
  );
}
