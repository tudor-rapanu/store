import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Admin Settings",
};

type AdminSettingsPageProps = {
  params: Promise<{ locale: string }>;
};

const SETTINGS_SECTIONS = [
  {
    title: "Homepage Sections",
    description: "Edit banners, featured products, and custom homepage blocks.",
    href: "homepage-sections",
  },
  {
    title: "Homepage Sliders",
    description: "Choose which category product sliders appear on the homepage.",
    href: "homepage-sliders",
  },
  {
    title: "Shipping & Currency",
    description: "Manage shipping profiles, international fares, and currency rates.",
    href: "shipping",
  },
  {
    title: "Size Guides",
    description: "Create reusable size charts for clothes and apparel products.",
    href: "size-guides",
  },
  {
    title: "Sameday Locations",
    description: "Sync cached counties and cities for checkout and AWB generation.",
    href: "sameday",
  },
] as const;

export default async function AdminSettingsPage({ params }: AdminSettingsPageProps) {
  const { locale } = await params;
  const activeLocale = locale === "ro" ? "ro" : "en";

  if (!(await isAdminUser())) {
    redirect(`/${activeLocale}`);
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-16">
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-black pb-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter">Settings</h1>
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
            Admin configuration
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="rounded-none border-black text-xs font-bold uppercase tracking-widest"
        >
          <Link href={`/${activeLocale}/admin/orders`}>Back to Orders</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {SETTINGS_SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={`/${activeLocale}/admin/settings/${section.href}`}
            className="group flex min-h-40 flex-col justify-between border border-black p-4 transition-colors hover:bg-black hover:text-white"
          >
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">
                {section.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600 transition-colors group-hover:text-white/75">
                {section.description}
              </p>
            </div>
            <span className="mt-6 text-xs font-black uppercase tracking-widest">
              Open Settings
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
