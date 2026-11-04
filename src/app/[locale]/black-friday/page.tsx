import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { BlackFridayCountdown } from "@/components/black-friday/BlackFridayCountdown";
import { ProductCategorySlider } from "@/components/product/ProductCategorySlider";
import { Button } from "@/components/ui/button";
import {
  BLACK_FRIDAY_UI_COPY,
  type BlackFridaySettings,
} from "@/lib/black-friday/campaign";
import { getCachedBlackFridaySettings } from "@/lib/black-friday/settings";
import { buildBlackFridaySliders } from "@/lib/black-friday/sliders";
import {
  getCachedPublicCategories,
  getCachedPublicProductCategoryLinks,
} from "@/lib/catalog/cache";
import { getCategoryAndDescendantIds } from "@/lib/categories";
import { getCurrencyPresentation } from "@/lib/currency/display";
import { getCatalogAutomaticDiscountPrices } from "@/lib/discounts";
import { getTranslatedText } from "@/lib/i18n/text";
import { getProductPricePresentation } from "@/lib/product-pricing";

export const metadata: Metadata = {
  title: "Black Friday",
};

const PRODUCTS_PER_SLIDER = 24;

const pageCopy = {
  en: {
    empty: "Discounted products are on their way. Check back in a moment.",
    allProducts: "View All Products",
  },
  ro: {
    empty: "Produsele reduse sunt pe drum. Revino în câteva momente.",
    allProducts: "Vezi Toate Produsele",
  },
} as const;

type BlackFridayPageProps = Readonly<{
  params: Promise<Readonly<{ locale: string }>>;
}>;

type PageState = "teaser" | "sale" | "ended";

function getPageState(settings: BlackFridaySettings, now = Date.now()): PageState {
  if (now >= Date.parse(settings.saleEndsAt ?? "")) {
    return "ended";
  }

  return now < Date.parse(settings.saleStartsAt ?? "") ? "teaser" : "sale";
}

async function getDiscountedCategorySliders() {
  const [links, categories, currencyPresentation] = await Promise.all([
    getCachedPublicProductCategoryLinks(),
    getCachedPublicCategories(),
    getCurrencyPresentation(),
  ]);
  const productLinks = links.map(({ categoryId, ...product }) => ({
    categoryId,
    product,
  }));
  const productsById = new Map(
    productLinks.map(({ product }) => [product.id, product]),
  );
  const catalogDiscounts = await getCatalogAutomaticDiscountPrices(
    Array.from(productsById.values()),
  );
  // A product counts as discounted if its own sale price is live or an automatic
  // (storewide, category, or product) discount applies to it.
  const discountedProductIds = new Set(
    Array.from(productsById.values())
      .filter(
        (product) =>
          catalogDiscounts.has(product.id) ||
          getProductPricePresentation(product).isOnSale,
      )
      .map((product) => product.id),
  );
  const descendantIdsByCategoryId = new Map(
    categories
      .filter((category) => !category.parentId)
      .map((category) => [
        category.id,
        getCategoryAndDescendantIds(categories, category.id),
      ]),
  );

  return {
    sliders: buildBlackFridaySliders({
      categories,
      descendantIdsByCategoryId,
      links: productLinks,
      discountedProductIds,
      productsPerSlider: PRODUCTS_PER_SLIDER,
    }),
    catalogDiscounts,
    currencyPresentation,
  };
}

export default async function BlackFridayPage({ params }: BlackFridayPageProps) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";
  const settings = await getCachedBlackFridaySettings();

  if (!settings.enabled || !settings.saleStartsAt || !settings.saleEndsAt) {
    notFound();
  }

  const state = getPageState(settings);
  const copy = pageCopy[activeLocale];
  const uiCopy = BLACK_FRIDAY_UI_COPY[activeLocale];
  const campaignCopy = settings.copy[activeLocale];

  // Once the sale is over the site goes back to normal: no leftover sale page,
  // including for visitors whose countdown just hit zero and refreshed the page.
  if (state === "ended") {
    redirect(`/${activeLocale}`);
  }

  const isSale = state === "sale";

  return (
    <main className="mx-auto max-w-7xl px-4 py-16 sm:px-8">
      <BlackFridayHero
        title={isSale ? campaignCopy.saleTitle : campaignCopy.teaserTitle}
        text={isSale ? campaignCopy.saleText : campaignCopy.teaserText}
      >
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">
            {isSale ? uiCopy.endsIn : uiCopy.startsIn}
          </p>
          <BlackFridayCountdown
            locale={activeLocale}
            target={Date.parse(isSale ? settings.saleEndsAt : settings.saleStartsAt)}
          />
        </div>
      </BlackFridayHero>

      {isSale && <BlackFridaySliders locale={activeLocale} copy={copy} />}
    </main>
  );
}

async function BlackFridaySliders({
  locale,
  copy,
}: {
  locale: "en" | "ro";
  copy: (typeof pageCopy)["en" | "ro"];
}) {
  const { sliders, catalogDiscounts, currencyPresentation } =
    await getDiscountedCategorySliders();

  if (sliders.length === 0) {
    return (
      <section className="space-y-6 py-12">
        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
          {copy.empty}
        </p>
        <AllProductsButton locale={locale} label={copy.allProducts} />
      </section>
    );
  }

  return (
    <div>
      {sliders.map((slider) => (
        <ProductCategorySlider
          key={slider.category.id}
          title={getTranslatedText(slider.category.name, locale)}
          href={`/${locale}/category/${slider.category.slug}`}
          products={slider.products}
          locale={locale}
          displayCurrency={currencyPresentation.displayCurrency}
          ronToEurRate={currencyPresentation.ronToEurRate}
          catalogDiscounts={catalogDiscounts}
        />
      ))}
    </div>
  );
}

function BlackFridayHero({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-10 bg-black px-6 py-12 text-white sm:px-10 sm:py-16">
      <div className="space-y-4">
        <h1 className="text-5xl font-black uppercase leading-[0.9] tracking-tighter text-[#ffd83f] sm:text-7xl md:text-8xl">
          {title}
        </h1>
        <p className="max-w-2xl text-base leading-7 text-white/75 sm:text-lg">{text}</p>
      </div>
      {children}
    </section>
  );
}

function AllProductsButton({ locale, label }: { locale: "en" | "ro"; label: string }) {
  return (
    <Button
      asChild
      className="h-12 w-full rounded-none bg-black px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900 sm:w-auto"
    >
      <Link href={`/${locale}/products`}>{label}</Link>
    </Button>
  );
}
