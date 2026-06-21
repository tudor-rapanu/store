"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SearchBar({ locale }: { locale: "en" | "ro" }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      const encodedQuery = encodeURIComponent(query.trim());
      router.push(`/${locale}/search?q=${encodedQuery}`);
    }
  };

  return (
    <form
      onSubmit={handleSearch}
      className="flex w-full max-w-md items-center gap-2"
    >
      <Input
        type="search"
        placeholder={
          locale === "en" ? "SEARCH SERIES 01..." : "CAUTĂ ÎN SERIES 01..."
        }
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="rounded-none border-black uppercase text-xs font-bold tracking-widest h-11"
      />
      <Button
        type="submit"
        className="rounded-none bg-black text-white hover:bg-slate-800 uppercase tracking-widest font-bold h-11 px-6"
      >
        {locale === "en" ? "Go" : "Caută"}
      </Button>
    </form>
  );
}
