import { AdminProductForm } from "@/components/product/AdminProductForm";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { getTranslatedText } from "@/lib/i18n/text";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Product",
};

type NewProductPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function NewProductPage({ params }: NewProductPageProps) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";
  const allCategories = await db.select().from(categories);

  return (
    <main className="max-w-3xl mx-auto px-4 py-16 min-h-[calc(100vh-8rem)]">
      <div className="mb-8 border-b border-black pb-4">
        <h1 className="text-4xl font-black tracking-tighter uppercase">
          Add New Product
        </h1>
        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
          Inventory Management
        </p>
      </div>

      <AdminProductForm
        locale={activeLocale}
        availableCategories={allCategories.map((category) => ({
          id: category.id,
          name: getTranslatedText(category.name, activeLocale, category.slug),
          value: getTranslatedText(category.name, "en", category.slug),
        }))}
      />
    </main>
  );
}
