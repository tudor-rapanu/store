import Link from "next/link";

import { Button } from "@/components/ui/button";

type SettingsPageHeaderProps = {
  activeLocale: "en" | "ro";
  title: string;
  description: string;
};

export function SettingsPageHeader({
  activeLocale,
  title,
  description,
}: SettingsPageHeaderProps) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4 border-b border-black pb-4">
      <div>
        <h1 className="text-4xl font-black uppercase tracking-tighter">{title}</h1>
        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">
          {description}
        </p>
      </div>
      <Button
        asChild
        variant="outline"
        className="rounded-none border-black text-xs font-bold uppercase tracking-widest"
      >
        <Link href={`/${activeLocale}/admin/settings`}>Back to Settings</Link>
      </Button>
    </div>
  );
}
