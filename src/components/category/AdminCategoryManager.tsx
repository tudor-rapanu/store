"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";

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
import { StatusBadge } from "@/components/order/StatusBadge";
import { getProductImageSrc } from "@/lib/product-images";

type ProductSummary = {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  isPrivate?: boolean;
};

type CategorySummary = {
  id: string;
  parentId: string | null;
  slug: string;
  nameEn: string;
  nameRo: string;
  depth?: number;
  products: ProductSummary[];
};

type CategoryDraft = {
  nameEn: string;
  nameRo: string;
  slug: string;
  parentId: string;
};

function getCategoryDraft(category: CategorySummary): CategoryDraft {
  return {
    nameEn: category.nameEn,
    nameRo: category.nameRo,
    slug: category.slug,
    parentId: category.parentId ?? "",
  };
}

export function AdminCategoryManager({
  categories,
  products,
  locale,
}: {
  categories: CategorySummary[];
  products: ProductSummary[];
  locale: "en" | "ro";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      categories.map((category) => [category.id, getCategoryDraft(category)]),
    ),
  );
  const mergedDrafts = useMemo(
    () =>
      Object.fromEntries(
        categories.map((category) => [
          category.id,
          drafts[category.id] ?? getCategoryDraft(category),
        ]),
      ),
    [categories, drafts],
  );

  async function requestJson(key: string, url: string, options: RequestInit) {
    setError(null);
    setPendingKey(key);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !result.ok) {
        setError(result.error ?? "The category could not be updated.");
        return false;
      }

      router.refresh();
      return true;
    } catch {
      setError("The category could not be updated.");
      return false;
    } finally {
      setPendingKey(null);
    }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const didCreate = await requestJson("create", "/api/admin/categories", {
      method: "POST",
      body: JSON.stringify({
        nameEn: String(formData.get("nameEn") ?? ""),
        nameRo: String(formData.get("nameRo") ?? ""),
        slug: String(formData.get("slug") ?? ""),
        parentId: String(formData.get("parentId") ?? ""),
      }),
    });

    if (didCreate) {
      form.reset();
    }
  }

  function updateDraft(
    categoryId: string,
    field: "nameEn" | "nameRo" | "slug" | "parentId",
    value: string,
  ) {
    const category = categories.find((item) => item.id === categoryId);

    setDrafts((current) => ({
      ...current,
      [categoryId]: {
        ...(current[categoryId] ??
          (category
            ? getCategoryDraft(category)
            : { nameEn: "", nameRo: "", slug: "", parentId: "" })),
        [field]: value,
      },
    }));
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={createCategory}
        className="grid gap-4 border border-black p-4 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end"
      >
        <div className="space-y-2">
          <Label
            htmlFor="nameEn"
            className="text-xs font-bold uppercase tracking-widest"
          >
            Name EN
          </Label>
          <Input
            id="nameEn"
            name="nameEn"
            required
            className="h-12 rounded-none border-black"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="nameRo"
            className="text-xs font-bold uppercase tracking-widest"
          >
            Name RO
          </Label>
          <Input id="nameRo" name="nameRo" className="h-12 rounded-none border-black" />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="parentId"
            className="text-xs font-bold uppercase tracking-widest"
          >
            Parent
          </Label>
          <select
            id="parentId"
            name="parentId"
            className="h-12 w-full rounded-none border border-black bg-white px-3 text-sm"
          >
            <option value="">Main category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {`${"— ".repeat(category.depth ?? 0)}${
                  locale === "ro" ? category.nameRo || category.nameEn : category.nameEn
                }`}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug" className="text-xs font-bold uppercase tracking-widest">
            Slug
          </Label>
          <Input
            id="slug"
            name="slug"
            placeholder="auto if empty"
            className="h-12 rounded-none border-black"
          />
        </div>
        <Button
          type="submit"
          disabled={pendingKey === "create"}
          className="h-12 rounded-none bg-black px-5 text-white hover:bg-slate-900"
        >
          <Plus size={16} /> Create
        </Button>
      </form>

      {error && (
        <div className="border border-destructive bg-destructive/10 p-4 text-sm font-bold uppercase tracking-wider text-destructive">
          {error}
        </div>
      )}

      <div className="divide-y divide-black border border-black">
        {categories.length === 0 ? (
          <div className="p-6 text-sm font-bold uppercase tracking-widest text-slate-500">
            No categories yet.
          </div>
        ) : (
          categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              categories={categories}
              draft={mergedDrafts[category.id] ?? getCategoryDraft(category)}
              products={products}
              locale={locale}
              pendingKey={pendingKey}
              onDraftChange={updateDraft}
              onRequest={requestJson}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  categories,
  draft,
  products,
  locale,
  pendingKey,
  onDraftChange,
  onRequest,
}: {
  category: CategorySummary;
  categories: CategorySummary[];
  draft: CategoryDraft;
  products: ProductSummary[];
  locale: "en" | "ro";
  pendingKey: string | null;
  onDraftChange: (
    categoryId: string,
    field: "nameEn" | "nameRo" | "slug" | "parentId",
    value: string,
  ) => void;
  onRequest: (key: string, url: string, options: RequestInit) => Promise<boolean>;
}) {
  const linkedProductIds = useMemo(
    () => new Set(category.products.map((product) => product.id)),
    [category.products],
  );
  const availableProducts = products.filter(
    (product) => !linkedProductIds.has(product.id),
  );
  return (
    <details className="group">
      <summary className="grid cursor-pointer gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 className="font-black uppercase tracking-tight">
            <span style={{ paddingLeft: `${(category.depth ?? 0) * 18}px` }}>
              {locale === "ro" ? category.nameRo || category.nameEn : category.nameEn}
            </span>
          </h2>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            {category.slug}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest">
          <span className="border border-black px-3 py-2">
            {category.products.length} products
          </span>
          <span className="text-slate-500 group-open:hidden">Open</span>
          <span className="hidden text-slate-500 group-open:inline">Close</span>
        </div>
      </summary>

      <div className="space-y-6 border-t border-black p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] md:items-end">
          <Input
            value={draft.nameEn}
            onChange={(event) =>
              onDraftChange(category.id, "nameEn", event.target.value)
            }
            className="h-10 rounded-none border-black"
            aria-label="English category name"
          />
          <Input
            value={draft.nameRo}
            onChange={(event) =>
              onDraftChange(category.id, "nameRo", event.target.value)
            }
            className="h-10 rounded-none border-black"
            aria-label="Romanian category name"
          />
          <Input
            value={draft.slug}
            onChange={(event) => onDraftChange(category.id, "slug", event.target.value)}
            className="h-10 rounded-none border-black"
            aria-label="Category slug"
          />
          <select
            value={draft.parentId}
            onChange={(event) =>
              onDraftChange(category.id, "parentId", event.target.value)
            }
            className="h-10 rounded-none border border-black bg-white px-3 text-sm"
            aria-label="Parent category"
          >
            <option value="">Main category</option>
            {categories
              .filter((item) => item.id !== category.id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {`${"— ".repeat(item.depth ?? 0)}${
                    locale === "ro" ? item.nameRo || item.nameEn : item.nameEn
                  }`}
                </option>
              ))}
          </select>
          <Button
            type="button"
            variant="outline"
            disabled={pendingKey === `save-${category.id}`}
            onClick={() =>
              onRequest(`save-${category.id}`, `/api/admin/categories/${category.id}`, {
                method: "PATCH",
                body: JSON.stringify(draft),
              })
            }
            className="h-10 rounded-none border-black text-xs font-bold uppercase tracking-widest"
          >
            <Save size={14} /> Save
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pendingKey === `delete-${category.id}`}
            onClick={() => {
              if (window.confirm("Delete this category? Products stay intact.")) {
                void onRequest(
                  `delete-${category.id}`,
                  `/api/admin/categories/${category.id}`,
                  { method: "DELETE" },
                );
              }
            }}
            className="h-10 rounded-none border-black text-xs font-bold uppercase tracking-widest"
          >
            <Trash2 size={14} /> Delete
          </Button>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest">
            Products in category
          </h3>

          {category.products.length === 0 ? (
            <div className="text-sm text-slate-500">No products linked.</div>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200">
              {category.products.map((product) => (
                <div
                  key={product.id}
                  className="grid gap-3 p-3 md:grid-cols-[1fr_auto_auto] md:items-center"
                >
                  <div className="flex items-center gap-3">
                    <ProductThumbnail key={product.imageUrl} product={product} />
                    <div>
                      <div className="font-bold uppercase tracking-tight">
                        {product.title}
                      </div>
                      <div className="text-xs uppercase tracking-widest text-slate-500">
                        {product.slug}
                      </div>
                    </div>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    className="h-9 rounded-none border-black text-xs font-bold uppercase tracking-widest"
                  >
                    <a href={`/${locale}/products/${product.slug}`}>View</a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pendingKey === `unlink-${category.id}-${product.id}`}
                    onClick={() =>
                      onRequest(
                        `unlink-${category.id}-${product.id}`,
                        `/api/admin/categories/${category.id}/products/${product.id}`,
                        { method: "DELETE" },
                      )
                    }
                    className="h-9 rounded-none border-black text-xs font-bold uppercase tracking-widest"
                  >
                    <X size={14} /> Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <AddProductsToCategory
          categoryId={category.id}
          availableProducts={availableProducts}
          pendingKey={pendingKey}
          onRequest={onRequest}
        />
      </div>
    </details>
  );
}

function AddProductsToCategory({
  categoryId,
  availableProducts,
  pendingKey,
  onRequest,
}: {
  categoryId: string;
  availableProducts: ProductSummary[];
  pendingKey: string | null;
  onRequest: (key: string, url: string, options: RequestInit) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const requestKey = `link-${categoryId}`;
  const isPending = pendingKey === requestKey;

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return availableProducts;
    }

    return availableProducts.filter(
      (product) =>
        product.title.toLowerCase().includes(query) ||
        product.slug.toLowerCase().includes(query),
    );
  }, [availableProducts, search]);

  function toggleProduct(productId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }

      return next;
    });
  }

  async function addSelectedProducts() {
    const ok = await onRequest(
      requestKey,
      `/api/admin/categories/${categoryId}/products`,
      {
        method: "POST",
        body: JSON.stringify({ productIds: Array.from(selectedIds) }),
      },
    );

    if (ok) {
      setSelectedIds(new Set());
      setSearch("");
      setOpen(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          disabled={availableProducts.length === 0}
          className="h-10 rounded-none bg-black text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-900"
        >
          <Plus size={14} /> Add Products
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add products to category</SheetTitle>
        </SheetHeader>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by title or slug"
          className="h-10 rounded-none border-black"
          aria-label="Search products"
        />

        <div className="flex-1 divide-y divide-slate-200 overflow-y-auto border border-slate-200">
          {filteredProducts.length === 0 ? (
            <div className="p-3 text-sm text-slate-500">No products match.</div>
          ) : (
            filteredProducts.map((product) => (
              <label
                key={product.id}
                className="flex cursor-pointer items-center gap-3 p-3 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(product.id)}
                  onChange={() => toggleProduct(product.id)}
                  className="size-4 shrink-0"
                />
                <ProductThumbnail key={product.imageUrl} product={product} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold uppercase tracking-tight">
                    {product.title}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    {product.slug}
                  </div>
                </div>
                {product.isPrivate && (
                  <StatusBadge value="private" className="shrink-0 px-2 py-1" />
                )}
              </label>
            ))
          )}
        </div>

        <SheetFooter>
          <Button
            type="button"
            disabled={selectedIds.size === 0 || isPending}
            onClick={addSelectedProducts}
            className="h-10 rounded-none bg-black text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-900"
          >
            <Plus size={14} />
            {isPending
              ? "Adding..."
              : selectedIds.size === 0
                ? "Add Products"
                : `Add ${selectedIds.size} Product${selectedIds.size === 1 ? "" : "s"}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ProductThumbnail({ product }: { product: ProductSummary }) {
  const imageSrcs = useMemo(
    () =>
      [
        getProductImageSrc(product.imageUrl, "thumb"),
        getProductImageSrc(product.imageUrl, "card"),
        getProductImageSrc(product.imageUrl, "large"),
      ].filter(
        (src, index, sources): src is string =>
          Boolean(src) && sources.indexOf(src) === index,
      ),
    [product.imageUrl],
  );
  const [imageIndex, setImageIndex] = useState(0);
  const imageSrc = imageSrcs[imageIndex];

  return (
    <div className="relative size-12 shrink-0 overflow-hidden border border-slate-200 bg-white">
      {imageSrc ? (
        <Image
          key={imageSrc}
          src={imageSrc}
          alt={product.title}
          fill
          unoptimized
          onError={() => setImageIndex((current) => current + 1)}
          className="object-contain p-1.5"
          sizes="48px"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-[9px] font-bold uppercase tracking-widest text-slate-300">
          No Image
        </div>
      )}
    </div>
  );
}
