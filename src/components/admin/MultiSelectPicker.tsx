"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";

import { StatusBadge } from "@/components/order/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getProductImageSrc } from "@/lib/product-images";

export type PickerItem = {
  id: string;
  label: string;
  sublabel?: string;
  imageUrl?: string | null;
  isPrivate?: boolean;
};

type MultiSelectPickerProps = {
  label: string;
  items: PickerItem[];
  value: string[];
  onChange: (ids: string[]) => void;
  noun: { singular: string; plural: string };
  showThumbnails?: boolean;
  // Lets the admin order the selection (e.g. which slider comes first).
  reorderable?: boolean;
};

export function MultiSelectPicker({
  label,
  items,
  value,
  onChange,
  noun,
  showThumbnails = false,
  reorderable = false,
}: MultiSelectPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const selectedIds = useMemo(() => new Set(value), [value]);
  const selectedItems = value
    .map((id) => itemsById.get(id))
    .filter((item): item is PickerItem => Boolean(item));

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return items;
    }

    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.sublabel?.toLowerCase().includes(query),
    );
  }, [items, search]);

  function toggleItem(id: string) {
    onChange(
      selectedIds.has(id) ? value.filter((itemId) => itemId !== id) : [...value, id],
    );
  }

  function moveItem(id: string, direction: -1 | 1) {
    const index = value.indexOf(id);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= value.length) {
      return;
    }

    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    onChange(next);
  }

  const countLabel = `${selectedItems.length} ${
    selectedItems.length === 1 ? noun.singular : noun.plural
  } selected`;

  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-widest">{label}</Label>
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);

          if (!nextOpen) {
            setSearch("");
          }
        }}
      >
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-start rounded-none border-black px-3 text-sm font-normal normal-case tracking-normal"
          >
            {selectedItems.length > 0 ? (
              countLabel
            ) : (
              <span className="text-slate-500">Select {noun.plural}</span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Select {noun.plural}</SheetTitle>
          </SheetHeader>

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={showThumbnails ? "Search by title or slug" : "Search"}
            className="h-10 rounded-none border-black"
            aria-label={`Search ${noun.plural}`}
          />

          <div className="flex-1 divide-y divide-slate-200 overflow-y-auto border border-slate-200">
            {filteredItems.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">No {noun.plural} match.</div>
            ) : (
              filteredItems.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-3 p-3 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                    className="size-4 shrink-0"
                  />
                  {showThumbnails && <PickerThumbnail item={item} />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold uppercase tracking-tight">
                      {item.label}
                    </div>
                    {item.sublabel && (
                      <div className="truncate text-xs uppercase tracking-widest text-slate-500">
                        {item.sublabel}
                      </div>
                    )}
                  </div>
                  {item.isPrivate && (
                    <StatusBadge value="private" className="shrink-0 px-2 py-1" />
                  )}
                </label>
              ))
            )}
          </div>

          <SheetFooter>
            <Button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 rounded-none bg-black text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-900"
            >
              Done{selectedItems.length > 0 ? ` (${countLabel})` : ""}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {selectedItems.length > 0 && (
        <ul className="divide-y divide-slate-200 border border-slate-200">
          {selectedItems.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2 p-2 text-sm">
              {showThumbnails && <PickerThumbnail item={item} />}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {reorderable && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={index === 0}
                    onClick={() => moveItem(item.id, -1)}
                    className="size-8 rounded-none border-black disabled:opacity-40"
                    aria-label={`Move ${item.label} up`}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={index === selectedItems.length - 1}
                    onClick={() => moveItem(item.id, 1)}
                    className="size-8 rounded-none border-black disabled:opacity-40"
                    aria-label={`Move ${item.label} down`}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => toggleItem(item.id)}
                className="size-8 rounded-none border-black"
                aria-label={`Remove ${item.label}`}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PickerThumbnail({ item }: { item: PickerItem }) {
  const imageSrc = getProductImageSrc(item.imageUrl, "thumb");

  return (
    <div className="relative size-10 shrink-0 overflow-hidden border border-slate-200 bg-white">
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={item.label}
          fill
          unoptimized
          className="object-contain p-1"
          sizes="40px"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-[8px] font-bold uppercase tracking-widest text-slate-300">
          No image
        </div>
      )}
    </div>
  );
}
