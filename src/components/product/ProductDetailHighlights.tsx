import { getTranslatedText } from "@/lib/i18n/text";
import { getProductDetailIcon } from "@/lib/product-detail-icons";

type ProductDetailHighlight = {
  id: string;
  icon: string;
  label: {
    en: string;
    ro: string;
  };
  value: {
    en: string;
    ro: string;
  };
};

export function ProductDetailHighlights({
  details,
  locale,
}: {
  details: ProductDetailHighlight[];
  locale: "en" | "ro";
}) {
  if (details.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {details.slice(0, 8).map((detail) => {
        const Icon = getProductDetailIcon(detail.icon);
        const label = getTranslatedText(detail.label, locale);
        const value = getTranslatedText(detail.value, locale);

        return (
          <div
            key={detail.id}
            className="flex flex-col items-start gap-3 border border-black p-4"
          >
            <span className="flex size-12 items-center justify-center rounded-full border border-black">
              <Icon size={22} strokeWidth={1.8} />
            </span>
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                {label}
              </p>
              <p className="text-sm font-bold leading-6 text-black">{value}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
