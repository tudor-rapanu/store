import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product/ProductCard";
import type { HomepageContentSection } from "@/lib/homepage/settings";
import { getProductImageSrc } from "@/lib/product-images";

type Product = {
  id: string;
  slug: string;
  title?: {
    en: string;
    ro: string;
  } | null;
  basePrice: number;
  salePrice?: number | null;
  saleEnabled?: boolean | null;
  saleStartsAt?: Date | string | null;
  saleEndsAt?: Date | string | null;
  imageUrl?: string | null;
};

type HomepageContentSectionsProps = {
  sections: HomepageContentSection[];
  featuredProducts: Product[];
  locale: "en" | "ro";
  displayCurrency: "RON" | "EUR";
  ronToEurRate: number;
};

function getString(content: Record<string, unknown>, key: string) {
  const value = content[key];

  return typeof value === "string" ? value.trim() : "";
}

function getLocalizedString(
  content: Record<string, unknown>,
  key: string,
  locale: "en" | "ro",
) {
  return getString(content, `${key}${locale === "ro" ? "Ro" : "En"}`);
}

function isRenderableImageSrc(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return value.startsWith("/") || /^https?:\/\//i.test(value);
}

function getSlides(content: Record<string, unknown>) {
  return Array.isArray(content.slides)
    ? content.slides.filter(
        (slide): slide is Record<string, unknown> =>
          Boolean(slide && typeof slide === "object" && !Array.isArray(slide)),
      )
    : [];
}

export function HomepageContentSections({
  sections,
  featuredProducts,
  locale,
  displayCurrency,
  ronToEurRate,
}: HomepageContentSectionsProps) {
  if (sections.length === 0) {
    return null;
  }

  const productsById = new Map(featuredProducts.map((product) => [product.id, product]));

  return (
    <div className="space-y-12">
      {sections.map((section) => {
        if (section.type === "promoStrip") {
          return (
            <PromoStrip key={section.id} section={section} locale={locale} />
          );
        }

        if (section.type === "bannerSlider") {
          return (
            <BannerSlider key={section.id} section={section} locale={locale} />
          );
        }

        if (section.type === "featuredProduct") {
          return (
            <FeaturedProduct
              key={section.id}
              section={section}
              product={productsById.get(getString(section.content, "productId"))}
              locale={locale}
              displayCurrency={displayCurrency}
              ronToEurRate={ronToEurRate}
            />
          );
        }

        return (
          <ImageTextSection
            key={section.id}
            section={section}
            locale={locale}
            hero={section.type === "heroBanner"}
          />
        );
      })}
    </div>
  );
}

function PromoStrip({
  section,
  locale,
}: {
  section: HomepageContentSection;
  locale: "en" | "ro";
}) {
  const title = getLocalizedString(section.content, "title", locale);
  const body = getLocalizedString(section.content, "body", locale);
  const href = getString(section.content, "href");
  const cta = getLocalizedString(section.content, "cta", locale);

  if (!title && !body) {
    return null;
  }

  const content = (
    <div className="flex flex-col gap-2 border border-black bg-black px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
      <div>
        {title && (
          <p className="text-sm font-black uppercase tracking-widest">{title}</p>
        )}
        {body && <p className="text-sm text-white/80">{body}</p>}
      </div>
      {cta && <span className="text-xs font-black uppercase tracking-widest">{cta}</span>}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function ImageTextSection({
  section,
  locale,
  hero,
}: {
  section: HomepageContentSection;
  locale: "en" | "ro";
  hero?: boolean;
}) {
  const title = getLocalizedString(section.content, "title", locale);
  const body = getLocalizedString(section.content, "body", locale);
  const href = getString(section.content, "href");
  const cta = getLocalizedString(section.content, "cta", locale);
  const imageUrl = getString(section.content, "imageUrl");

  if (!title && !body && !isRenderableImageSrc(imageUrl)) {
    return null;
  }

  return (
    <section
      className={
        hero
          ? "grid gap-8 border-b border-black pb-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end"
          : "grid gap-8 border-t border-black pt-12 lg:grid-cols-2 lg:items-center"
      }
    >
      {isRenderableImageSrc(imageUrl) && !hero && (
        <HomepageImage imageUrl={imageUrl} title={title} />
      )}
      <div className="space-y-5">
        {title && (
          <h1
            className={
              hero
                ? "max-w-4xl text-4xl font-black uppercase tracking-tighter sm:text-5xl lg:text-6xl"
                : "text-3xl font-black uppercase tracking-tight sm:text-4xl"
            }
          >
            {title}
          </h1>
        )}
        {body && <p className="max-w-2xl text-sm leading-7 text-slate-600">{body}</p>}
        {href && cta && (
          <Button
            asChild
            className="h-12 rounded-none bg-black px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900"
          >
            <Link href={href}>{cta}</Link>
          </Button>
        )}
      </div>
      {isRenderableImageSrc(imageUrl) && hero && (
        <HomepageImage imageUrl={imageUrl} title={title} />
      )}
    </section>
  );
}

function BannerSlider({
  section,
  locale,
}: {
  section: HomepageContentSection;
  locale: "en" | "ro";
}) {
  const slides = getSlides(section.content);

  if (slides.length === 0) {
    return null;
  }

  return (
    <section className="overflow-x-auto border-y border-black py-6">
      <div className="flex snap-x gap-4">
        {slides.map((slide, index) => (
          <div
            key={index}
            className="relative min-h-[340px] min-w-[86%] snap-start overflow-hidden border border-black bg-black text-white md:min-w-[560px]"
          >
            <SlideImage slide={slide} locale={locale} />
          </div>
        ))}
      </div>
    </section>
  );
}

function SlideImage({
  slide,
  locale,
}: {
  slide: Record<string, unknown>;
  locale: "en" | "ro";
}) {
  const title = getLocalizedString(slide, "title", locale);
  const body = getLocalizedString(slide, "body", locale);
  const href = getString(slide, "href");
  const cta = getLocalizedString(slide, "cta", locale);
  const imageUrl = getString(slide, "imageUrl");

  return (
    <>
      {isRenderableImageSrc(imageUrl) && (
        <Image src={imageUrl} alt="" fill unoptimized className="object-cover opacity-70" />
      )}
      <div className="absolute inset-0 flex flex-col justify-end gap-4 p-6">
        {title && (
          <h2 className="text-3xl font-black uppercase tracking-tight">
            {title}
          </h2>
        )}
        {body && <p className="max-w-md text-sm leading-7 text-white/85">{body}</p>}
        {href && cta && (
          <Link
            href={href}
            className="text-xs font-black uppercase tracking-widest underline underline-offset-4"
          >
            {cta}
          </Link>
        )}
      </div>
    </>
  );
}

function FeaturedProduct({
  section,
  product,
  locale,
  displayCurrency,
  ronToEurRate,
}: {
  section: HomepageContentSection;
  product?: Product;
  locale: "en" | "ro";
  displayCurrency: "RON" | "EUR";
  ronToEurRate: number;
}) {
  if (!product) {
    return null;
  }

  const title = getLocalizedString(section.content, "title", locale);
  const body = getLocalizedString(section.content, "body", locale);

  return (
    <section className="grid gap-8 border-t border-black pt-12 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-center">
      <ProductCard
        product={product}
        locale={locale}
        displayCurrency={displayCurrency}
        ronToEurRate={ronToEurRate}
      />
      <div className="space-y-5">
        {title && (
          <h2 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">
            {title}
          </h2>
        )}
        {body && <p className="max-w-2xl text-sm leading-7 text-slate-600">{body}</p>}
        <Button
          asChild
          className="h-12 rounded-none bg-black px-6 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-900"
        >
          <Link href={`/${locale}/products/${product.slug}`}>
            {locale === "ro" ? "Vezi produsul" : "View product"}
          </Link>
        </Button>
      </div>
    </section>
  );
}

function HomepageImage({
  imageUrl,
  title,
}: {
  imageUrl: string;
  title: string;
}) {
  const normalizedSrc = getProductImageSrc(imageUrl) ?? imageUrl;

  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-white">
      <Image
        src={normalizedSrc}
        alt={title}
        fill
        unoptimized
        className="object-cover"
      />
    </div>
  );
}
