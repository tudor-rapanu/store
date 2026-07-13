"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { logoutFromLocale } from "@/lib/actions/auth";

type AccountSidebarProps = {
  locale: "en" | "ro";
};

const ACCOUNT_SECTIONS = [
  { href: "#overview", label: "My Account" },
  { href: "#orders", label: "Order History" },
  { href: "#details", label: "Personal Details & Delivery" },
  { href: "#preferences", label: "Preferences" },
] as const;

export function AccountSidebar({ locale }: AccountSidebarProps) {
  const [activeHref, setActiveHref] = useState("#overview");

  useEffect(() => {
    function syncHash() {
      setActiveHref(window.location.hash || "#overview");
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return (
    <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
      {ACCOUNT_SECTIONS.map((section) => (
        <AccountMenuLink
          key={section.href}
          href={section.href}
          active={activeHref === section.href}
          onClick={() => setActiveHref(section.href)}
        >
          {section.label}
        </AccountMenuLink>
      ))}
      <AccountMenuLink href={`/${locale}/account/orders`}>All Orders</AccountMenuLink>
      <form action={logoutFromLocale}>
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          className="flex min-h-14 w-full items-center border border-slate-200 px-5 text-left text-sm font-black uppercase tracking-widest transition-colors hover:border-black hover:bg-black hover:text-white"
        >
          Logout
        </button>
      </form>
    </aside>
  );
}

function AccountMenuLink({
  href,
  active = false,
  onClick,
  children,
}: {
  href: string;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex min-h-14 items-center border px-5 text-sm font-black uppercase tracking-widest transition-colors ${
        active
          ? "border-black bg-black text-white"
          : "border-slate-200 hover:border-black hover:bg-black hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
