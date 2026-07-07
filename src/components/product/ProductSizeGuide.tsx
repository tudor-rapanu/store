import Image from "next/image";

import type { SizeGuideRow, TranslatedText } from "@/lib/db/schema";
import { getTranslatedText } from "@/lib/i18n/text";

type ProductSizeGuideData = {
  id: string;
  title: TranslatedText;
  description?: TranslatedText | null;
  imageUrl?: string | null;
  columns: string[];
  rows: SizeGuideRow[];
};

function isRenderableImageSrc(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return value.startsWith("/") || /^https?:\/\//i.test(value);
}

export function ProductSizeGuide({
  sizeGuide,
  locale,
}: {
  sizeGuide: ProductSizeGuideData | null;
  locale: "en" | "ro";
}) {
  if (!sizeGuide || sizeGuide.columns.length === 0 || sizeGuide.rows.length === 0) {
    return null;
  }

  const title = getTranslatedText(sizeGuide.title, locale, "Size guide");
  const description = getTranslatedText(sizeGuide.description, locale);
  const imageUrl = isRenderableImageSrc(sizeGuide.imageUrl)
    ? sizeGuide.imageUrl
    : null;

  return (
    <section className="space-y-6 border-t border-black pt-10">
      <div>
        <h2 className="text-2xl font-black uppercase tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {description}
          </p>
        )}
      </div>

      {imageUrl && (
        <div className="relative aspect-[16/7] overflow-hidden bg-white">
          <Image
            src={imageUrl}
            alt=""
            fill
            unoptimized
            className="object-contain"
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-black">
              <th className="px-4 py-3 text-left text-base font-black uppercase">
                {locale === "ro" ? "Marimi" : "Sizes"}
              </th>
              {sizeGuide.columns.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-center text-base font-black uppercase"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizeGuide.rows.map((row, rowIndex) => (
              <tr key={`${row.label}-${rowIndex}`} className="border-b">
                <td className="px-4 py-3 text-left font-bold">{row.label}</td>
                {sizeGuide.columns.map((column, columnIndex) => (
                  <td key={column} className="px-4 py-3 text-center">
                    {row.values[columnIndex] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
