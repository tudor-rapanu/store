import { searchCatalog } from "@/lib/actions/search";
import { ProductCard } from "@/components/product/ProductCard";
import type { Metadata } from "next";

interface SearchPageProps {
  params: Promise<{ locale: "en" | "ro" }>;
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;

  return {
    title: q ? `Search: ${q}` : "Search",
  };
}

export default async function SearchPage({
  params,
  searchParams,
}: SearchPageProps) {
  const { locale } = await params;
  const { q } = await searchParams;
  const query = q || "";
  const results = await searchCatalog(query, locale);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 min-h-[calc(100vh-8rem)]">
      <div className="mb-12 border-b border-black pb-8">
        <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">
          {locale === "en" ? "Search Results" : "Rezultatele Căutării"}
        </h1>
        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
          {results.length}{" "}
          {locale === "en" ? "Items found for" : "Produse găsite pentru"} &quot;
          {query}&quot;
        </p>
      </div>

      {results.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
          {results.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              locale={locale}
              eager={index === 0}
            />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center">
          <p className="text-lg font-bold uppercase tracking-widest text-slate-400">
            {locale === "en"
              ? "No products match your search."
              : "Niciun produs nu corespunde căutării."}
          </p>
        </div>
      )}
    </main>
  );
}
