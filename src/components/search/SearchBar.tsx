"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SearchBar({
  locale,
  compact = false,
  onSearch,
}: {
  locale: "en" | "ro";
  compact?: boolean;
  onSearch?: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      const encodedQuery = encodeURIComponent(query.trim());
      router.push(`/${locale}/search?q=${encodedQuery}`);
      onSearch?.();
    }
  };

  return (
    <form
      onSubmit={handleSearch}
      className={`flex w-full items-center gap-2 ${compact ? "max-w-xs" : "max-w-md"}`}
    >
      <Input
        type="search"
        placeholder={
          compact
            ? locale === "en"
              ? "Search"
              : "Caută"
            : locale === "en"
              ? "SEARCH..."
              : "CAUTĂ ÎN..."
        }
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={`rounded-none border-gray-300 text-xs font-bold tracking-widest h-10 ${
          compact ? "" : "uppercase"
        }`}
      />
      <Button
        type="submit"
        className={`rounded-none bg-black text-white hover:bg-slate-800 uppercase tracking-widest font-bold h-10 ${
          compact ? "w-10 px-0" : "px-6"
        }`}
        aria-label={locale === "en" ? "Search" : "Caută"}
      >
        {compact ? <Search size={16} /> : locale === "en" ? "Go" : "Caută"}
      </Button>
    </form>
  );
}
