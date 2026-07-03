"use client";

import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

type LanguageSelectorProps = {
  locale: "en" | "ro";
};

export function LanguageSelector({ locale }: LanguageSelectorProps) {
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(nextLocale: string) {
    if (nextLocale !== "en" && nextLocale !== "ro") {
      return;
    }

    const segments = pathname.split("/");
    if (segments[1] === "en" || segments[1] === "ro") {
      segments[1] = nextLocale;
      router.push(segments.join("/") || `/${nextLocale}`);
      return;
    }

    router.push(`/${nextLocale}`);
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={locale}
        onChange={(event) => switchLocale(event.target.value)}
        aria-label="Language"
        className="appearance-none bg-transparent py-2 pl-0 pr-4 text-xs font-bold uppercase tracking-widest text-current outline-none transition-colors hover:text-slate-500"
      >
        <option value="en">EN</option>
        <option value="ro">RO</option>
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-0 h-3 w-3"
        strokeWidth={2}
      />
    </div>
  );
}
