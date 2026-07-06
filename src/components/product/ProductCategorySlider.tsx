import Link from "next/link";

import { ProductCard } from "@/components/product/ProductCard";
import { ProductSliderControls } from "@/components/product/ProductSliderControls";

type Product = {
  id: string;
  slug: string;
  title: { en: string; ro: string };
  basePrice: number;
  salePrice?: number | null;
  saleEnabled?: boolean | null;
  saleStartsAt?: Date | string | null;
  saleEndsAt?: Date | string | null;
  imageUrl?: string | null;
};

type ProductCategorySliderProps = {
  title: string;
  href: string;
  products: Product[];
  locale: "en" | "ro";
  displayCurrency: "RON" | "EUR";
  ronToEurRate: number;
  catalogDiscounts: Map<
    string,
    {
      discountName: string;
      discountedPrice: number;
    }
  >;
};

export function ProductCategorySlider({
  title,
  href,
  products,
  locale,
  displayCurrency,
  ronToEurRate,
  catalogDiscounts,
}: ProductCategorySliderProps) {
  const sliderId = `product-slider-${href.replace(/[^a-z0-9]+/gi, "-")}`;

  return (
    <section className="border-t border-black py-12">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">
            {title}
          </h2>
          <Link
            href={href}
            className="mt-2 inline-block text-xs font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-black"
          >
            {locale === "ro" ? "Vezi categoria" : "View category"}
          </Link>
        </div>
        <ProductSliderControls targetId={sliderId} />
      </div>

      <div
        id={sliderId}
        className="flex snap-x gap-5 overflow-x-auto scroll-smooth pb-3 [-ms-overflow-style:none] [scrollbar-width:none] lg:gap-8 [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product, index) => (
          <div
            key={product.id}
            className="w-[72vw] max-w-[260px] shrink-0 snap-start sm:w-[230px] lg:w-[280px] lg:max-w-none xl:w-[300px]"
          >
            <ProductCard
              product={product}
              locale={locale}
              eager={index === 0}
              displayCurrency={displayCurrency}
              ronToEurRate={ronToEurRate}
              catalogDiscount={catalogDiscounts.get(product.id)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
