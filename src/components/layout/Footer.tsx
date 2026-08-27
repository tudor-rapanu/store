import Link from "next/link";
import { FooterCompliance } from "./FooterCompliance";

export function Footer({ locale }: { locale: "en" | "ro" }) {
  const links = [
    { href: `/${locale}/legal/terms`, label: "Terms" },
    { href: `/${locale}/legal/privacy`, label: "Privacy" },
    { href: `/${locale}/legal/delivery-and-returns`, label: "Delivery & Returns" },
    { href: `/${locale}/checkout`, label: "Checkout" },
  ];

  return (
    <footer className="border-t border-black bg-white">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-8">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <Link
              href={`/${locale}`}
              className="text-xl font-black uppercase tracking-tighter"
            >
              Todd&apos;s Threads
            </Link>
            <p className="mt-3 max-w-md text-xs font-bold uppercase tracking-widest text-slate-500">
              Independent apparel and accessories, shipped from Romania.
            </p>
          </div>

          <nav className="flex flex-wrap gap-4 text-xs font-bold uppercase tracking-widest md:justify-end">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-slate-500 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <FooterCompliance />
      </div>
    </footer>
  );
}
