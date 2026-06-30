"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getProductImageSrc } from "@/lib/product-images";

type Product = {
  id: string;
  slug: string;
  title: { en: string; ro: string };
  description?: { en: string; ro: string } | null;
  basePrice: number;
  isPrivate?: boolean;
};

type Variant = {
  name: string;
  sku: string;
  attributes: Record<string, string>;
  price: number;
  stock: number;
};

type OptionRow = {
  id: string;
  name: string;
  values: string;
};

type VariantRow = Variant & {
  id: string;
  skuWasEdited: boolean;
};

type AvailableCategory = {
  id: string;
  name: string;
  value: string;
};

function createId() {
  return crypto.randomUUID();
}

function splitValues(values: string) {
  return Array.from(
    new Set(
      values
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getVariantSlug(productSlug: string, variantName: string, index: number) {
  const cleanProductSlug = slugify(productSlug);
  const cleanVariantName = slugify(variantName);

  if (!cleanProductSlug || !cleanVariantName) {
    return "";
  }

  return `${cleanProductSlug}-${cleanVariantName}-${index + 1}`;
}

function deriveOptions(variants: Variant[]) {
  const optionMap = new Map<string, Set<string>>();

  variants.forEach((variant) => {
    Object.entries(variant.attributes).forEach(([key, value]) => {
      if (!optionMap.has(key)) {
        optionMap.set(key, new Set());
      }
      optionMap.get(key)?.add(value);
    });
  });

  return Array.from(optionMap.entries()).map(([name, values]) => ({
    id: createId(),
    name,
    values: Array.from(values).join(", "),
  }));
}

function getAttributeSignature(
  attributes: Record<string, string>,
  optionNames: string[],
) {
  return optionNames
    .map((name) => `${name}:${attributes[name] ?? ""}`)
    .join("|");
}

function getOptionCombinations(options: { name: string; values: string[] }[]) {
  return options.reduce<Record<string, string>[]>(
    (combinations, option) =>
      combinations.flatMap((combination) =>
        option.values.map((value) => ({
          ...combination,
          [option.name]: value,
        })),
      ),
    [{}],
  );
}

export function AdminProductForm({
  locale,
  product,
  variants = [],
  imagePaths = [],
  imageSources = {},
  categories = [],
  availableCategories = [],
}: {
  locale: "en" | "ro";
  product?: Product;
  variants?: Variant[];
  imagePaths?: string[];
  imageSources?: Record<string, string | null>;
  categories?: string[];
  availableCategories?: AvailableCategory[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugWasEdited, setSlugWasEdited] = useState(false);
  const [basePrice, setBasePrice] = useState(
    product ? (product.basePrice / 100).toFixed(2) : "",
  );
  const [existingImages, setExistingImages] = useState(imagePaths);
  const [selectedCategories, setSelectedCategories] = useState(categories);
  const [variantsEnabled, setVariantsEnabled] = useState(variants.length > 0);
  const [options, setOptions] = useState<OptionRow[]>(() =>
    deriveOptions(variants),
  );
  const [variantRows, setVariantRows] = useState<VariantRow[]>(() =>
    variants.map((variant) => ({
      ...variant,
      id: createId(),
      skuWasEdited: false,
    })),
  );

  const variantPayload = useMemo(() => {
    if (!variantsEnabled) {
      return "[]";
    }

    return JSON.stringify(
      variantRows.map((variant) => ({
        name: variant.name,
        sku: variant.sku,
        attributes: variant.attributes,
        price: variant.price,
        stock: variant.stock,
      })),
    );
  }, [variantRows, variantsEnabled]);
  const categoryPayload = selectedCategories.join(", ");
  const selectedCategoryLabels = selectedCategories.map((categoryValue) => {
    const category = availableCategories.find(
      (item) => item.value === categoryValue,
    );

    return category?.name ?? categoryValue;
  });

  function moveImage(index: number, direction: -1 | 1) {
    setExistingImages((current) => {
      const next = [...current];
      const targetIndex = index + direction;

      if (targetIndex < 0 || targetIndex >= next.length) {
        return current;
      }

      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function updateOption(id: string, field: "name" | "values", value: string) {
    setOptions((current) =>
      current.map((option) =>
        option.id === id ? { ...option, [field]: value } : option,
      ),
    );
  }

  function updateVariant(
    id: string,
    field: keyof Omit<VariantRow, "id" | "attributes" | "skuWasEdited">,
    value: string,
  ) {
    setVariantRows((current) =>
      current.map((variant, index) => {
        if (variant.id !== id) {
          return variant;
        }

        if (field === "sku") {
          return {
            ...variant,
            sku: slugify(value),
            skuWasEdited: true,
          };
        }

        if (field === "name") {
          return {
            ...variant,
            name: value,
            sku: variant.skuWasEdited
              ? variant.sku
              : getVariantSlug(slug, value, index),
          };
        }

        return {
          ...variant,
          [field]: field === "price" || field === "stock" ? Number(value) : value,
        };
      }),
    );
  }

  function updateVariantAttribute(id: string, key: string, value: string) {
    setVariantRows((current) =>
      current.map((variant) =>
        variant.id === id
          ? {
              ...variant,
              attributes: { ...variant.attributes, [key]: value },
            }
          : variant,
      ),
    );
  }

  function addVariant() {
    const attributes = Object.fromEntries(
      options
        .filter((option) => option.name.trim())
        .map((option) => [option.name.trim(), splitValues(option.values)[0] ?? ""]),
    );

    setVariantRows((current) => [
      ...current,
      {
        id: createId(),
        name: "",
        sku: getVariantSlug(slug, "", current.length),
        skuWasEdited: false,
        attributes,
        price: product ? product.basePrice / 100 : 0,
        stock: 0,
      },
    ]);
  }

  function generateVariantMatrix() {
    const matrixOptions = options
      .map((option) => ({
        name: option.name.trim(),
        values: splitValues(option.values),
      }))
      .filter((option) => option.name);

    if (matrixOptions.length === 0) {
      setError("Add at least one variant type before generating variants.");
      return;
    }

    const missingValues = matrixOptions.find(
      (option) => option.values.length === 0,
    );

    if (missingValues) {
      setError(`Add at least one value for ${missingValues.name}.`);
      return;
    }

    const optionNames = matrixOptions.map((option) => option.name);
    const existingSignatures = new Set(
      variantRows.map((variant) =>
        getAttributeSignature(variant.attributes, optionNames),
      ),
    );
    const defaultPrice = Number(basePrice) || 0;
    const combinations = getOptionCombinations(matrixOptions);
    const missingVariants = combinations
      .map((attributes) => {
        const name = optionNames
          .map((optionName) => attributes[optionName])
          .join(" / ");
        const signature = getAttributeSignature(attributes, optionNames);

        return { attributes, name, signature };
      })
      .filter((combination) => !existingSignatures.has(combination.signature));

    setError(null);
    setSuccess(null);

    if (missingVariants.length === 0) {
      setSuccess("All generated variants are already added.");
      return;
    }

    setVariantRows((current) => [
      ...current,
      ...missingVariants.map(({ attributes, name }, index) => {
        const nextIndex = current.length + index;

        return {
          id: createId(),
          name,
          sku: getVariantSlug(slug, name, nextIndex),
          skuWasEdited: false,
          attributes,
          price: defaultPrice,
          stock: 0,
        };
      }),
    ]);
    setSuccess(
      `Added ${missingVariants.length} missing variants. ${combinations.length - missingVariants.length} already existed.`,
    );
  }

  function toggleCategory(categoryValue: string) {
    setSelectedCategories((current) =>
      current.includes(categoryValue)
        ? current.filter((name) => name !== categoryValue)
        : [...current, categoryValue],
    );
  }

  function handleTitleChange(value: string) {
    if (!slugWasEdited) {
      const nextSlug = slugify(value);

      setSlug(nextSlug);
      setVariantRows((current) =>
        current.map((variant, index) =>
          variant.skuWasEdited
            ? variant
            : {
                ...variant,
                sku: getVariantSlug(nextSlug, variant.name, index),
              },
        ),
      );
    }
  }

  function handleSlugChange(value: string) {
    const nextSlug = slugify(value);

    setSlug(nextSlug);
    setSlugWasEdited(true);
    setVariantRows((current) =>
      current.map((variant, index) =>
        variant.skuWasEdited
          ? variant
          : {
              ...variant,
              sku: getVariantSlug(nextSlug, variant.name, index),
            },
      ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    formData.set("existingImages", JSON.stringify(existingImages));
    formData.set("variants", variantPayload);
    formData.set("categories", categoryPayload);

    try {
      const response = await fetch(
        product ? `/api/admin/products/${product.id}` : "/api/admin/products",
        {
          method: product ? "PATCH" : "POST",
          body: formData,
        },
      );
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !result.ok) {
        setError(result.error ?? "The product could not be saved.");
        return;
      }

      setSuccess(product ? "Product updated." : "Product saved.");
      router.refresh();

      if (!product) {
        event.currentTarget.reset();
        setExistingImages([]);
        setSelectedCategories([]);
        setSlug("");
        setSlugWasEdited(false);
        setBasePrice("");
        setVariantsEnabled(false);
        setOptions([]);
        setVariantRows([]);
      }
    } catch {
      setError("The product could not be saved.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Card className="rounded-none border-black shadow-none">
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="variants" value={variantPayload} readOnly />
        <input
          type="hidden"
          name="categories"
          value={categoryPayload}
          readOnly
        />
        <input
          type="hidden"
          name="existingImages"
          value={JSON.stringify(existingImages)}
          readOnly
        />
        <CardContent className="space-y-8 pt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="titleEn" className="uppercase text-xs font-bold tracking-widest">
                Title (English)
              </Label>
              <Input id="titleEn" name="titleEn" required defaultValue={product?.title.en} onChange={(event) => handleTitleChange(event.target.value)} className="rounded-none border-black h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="titleRo" className="uppercase text-xs font-bold tracking-widest">
                Title (Romanian)
              </Label>
              <Input id="titleRo" name="titleRo" required defaultValue={product?.title.ro} className="rounded-none border-black h-11" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="descriptionEn" className="uppercase text-xs font-bold tracking-widest">
                Description (English)
              </Label>
              <textarea id="descriptionEn" name="descriptionEn" rows={5} defaultValue={product?.description?.en ?? ""} className="w-full rounded-none border border-black bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descriptionRo" className="uppercase text-xs font-bold tracking-widest">
                Description (Romanian)
              </Label>
              <textarea id="descriptionRo" name="descriptionRo" rows={5} defaultValue={product?.description?.ro ?? ""} className="w-full rounded-none border border-black bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="slug" className="uppercase text-xs font-bold tracking-widest">
                URL Slug
              </Label>
              <Input id="slug" name="slug" required value={slug} onChange={(event) => handleSlugChange(event.target.value)} className="rounded-none border-black h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price" className="uppercase text-xs font-bold tracking-widest">
                Base Price (RON)
              </Label>
              <Input id="price" name="price" type="number" step="0.01" required value={basePrice} onChange={(event) => setBasePrice(event.target.value)} className="rounded-none border-black h-11" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="uppercase text-xs font-bold tracking-widest">
              Categories
            </Label>
            <details className="group relative">
              <summary className="flex h-11 cursor-pointer list-none items-center justify-between border border-black px-3 text-sm [&::-webkit-details-marker]:hidden">
                <span className="truncate">
                  {selectedCategories.length > 0
                    ? selectedCategoryLabels.join(", ")
                    : "Select categories"}
                </span>
                <span className="text-xs font-black uppercase tracking-widest text-slate-500 group-open:hidden">
                  Open
                </span>
                <span className="hidden text-xs font-black uppercase tracking-widest text-slate-500 group-open:inline">
                  Close
                </span>
              </summary>
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto border border-black bg-white p-3 shadow-lg">
                {availableCategories.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      No categories yet.
                    </p>
                    <Link
                      href={`/${locale}/admin/categories`}
                      className="text-xs font-black uppercase tracking-widest underline"
                    >
                      Create categories
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableCategories.map((category) => (
                      <label
                        key={category.id}
                        className="flex cursor-pointer items-center gap-3 text-sm font-bold uppercase tracking-widest"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category.value)}
                          onChange={() => toggleCategory(category.value)}
                          className="size-4"
                        />
                        {category.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </details>
          </div>

          <label className="flex items-center gap-3 border border-black p-4 text-sm font-black uppercase tracking-widest">
            <input
              type="checkbox"
              name="isPrivate"
              defaultChecked={product?.isPrivate ?? false}
              className="size-4"
            />
            Private product
          </label>

          <section className="space-y-4 border border-black p-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">
                Product Images
              </h2>
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Reorder, delete, or upload more images for the gallery.
              </p>
            </div>

            {existingImages.length > 0 && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {existingImages.map((imagePath, index) => {
                  const src =
                    imageSources[imagePath] ?? getProductImageSrc(imagePath);

                  return (
                    <div key={imagePath} className="space-y-2">
                      <div className="relative aspect-square overflow-hidden border border-slate-200 bg-white">
                        {src && (
                          <Image src={src} alt="" fill unoptimized className="object-contain p-2" />
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <Button type="button" variant="outline" size="icon" onClick={() => moveImage(index, -1)} className="rounded-none border-black" aria-label="Move image up">
                          <ArrowUp size={14} />
                        </Button>
                        <Button type="button" variant="outline" size="icon" onClick={() => moveImage(index, 1)} className="rounded-none border-black" aria-label="Move image down">
                          <ArrowDown size={14} />
                        </Button>
                        <Button type="button" variant="outline" size="icon" onClick={() => setExistingImages((current) => current.filter((path) => path !== imagePath))} className="rounded-none border-black" aria-label="Delete image">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Input id="images" name="images" type="file" accept="image/png, image/jpeg, image/webp" multiple required={!product && existingImages.length === 0} className="rounded-none border-black file:bg-black file:text-white file:border-none file:mr-4 file:px-4 file:py-2 file:uppercase file:text-xs file:font-bold file:tracking-widest cursor-pointer" />
          </section>

          <section className="space-y-4 border border-black p-4">
            <label className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
              <input
                type="checkbox"
                checked={variantsEnabled}
                onChange={(event) => setVariantsEnabled(event.target.checked)}
                className="size-4"
              />
              Enable variants
            </label>

            {variantsEnabled && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest">
                      Variant Types
                    </h3>
                    <Button type="button" variant="outline" onClick={() => setOptions((current) => [...current, { id: createId(), name: "", values: "" }])} className="h-9 rounded-none border-black uppercase tracking-widest text-xs">
                      <Plus size={14} /> Type
                    </Button>
                  </div>
                  {options.map((option) => (
                    <div key={option.id} className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
                      <Input value={option.name} onChange={(event) => updateOption(option.id, "name", event.target.value)} placeholder="size" className="rounded-none border-black h-10" />
                      <Input value={option.values} onChange={(event) => updateOption(option.id, "values", event.target.value)} placeholder="S, M, L" className="rounded-none border-black h-10" />
                      <Button type="button" variant="outline" size="icon" onClick={() => setOptions((current) => current.filter((item) => item.id !== option.id))} className="rounded-none border-black" aria-label="Delete variant type">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest">
                      Variants
                    </h3>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="outline" onClick={generateVariantMatrix} className="h-9 rounded-none border-black uppercase tracking-widest text-xs">
                        Generate Matrix
                      </Button>
                      <Button type="button" variant="outline" onClick={addVariant} className="h-9 rounded-none border-black uppercase tracking-widest text-xs">
                        <Plus size={14} /> Variant
                      </Button>
                    </div>
                  </div>
                  {variantRows.map((variant) => (
                    <div key={variant.id} className="space-y-3 border border-slate-200 p-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        <Input value={variant.name} onChange={(event) => updateVariant(variant.id, "name", event.target.value)} placeholder="Black / Medium" className="rounded-none border-black h-10" />
                        <Input value={variant.sku} onChange={(event) => updateVariant(variant.id, "sku", event.target.value)} placeholder="SKU (optional)" className="rounded-none border-black h-10" />
                        <Input value={variant.price} onChange={(event) => updateVariant(variant.id, "price", event.target.value)} type="number" step="0.01" placeholder="Price RON" className="rounded-none border-black h-10" />
                        <Input value={variant.stock} onChange={(event) => updateVariant(variant.id, "stock", event.target.value)} type="number" placeholder="Stock" className="rounded-none border-black h-10" />
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {options
                          .filter((option) => option.name.trim())
                          .map((option) => (
                            <label key={option.id} className="space-y-1">
                              <span className="text-xs font-bold uppercase tracking-widest">
                                {option.name}
                              </span>
                              <select
                                value={variant.attributes[option.name.trim()] ?? ""}
                                onChange={(event) =>
                                  updateVariantAttribute(
                                    variant.id,
                                    option.name.trim(),
                                    event.target.value,
                                  )
                                }
                                className="h-10 w-full rounded-none border border-black bg-white px-3 text-sm"
                              >
                                {splitValues(option.values).map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                      </div>
                      <Button type="button" variant="outline" onClick={() => setVariantRows((current) => current.filter((item) => item.id !== variant.id))} className="h-9 rounded-none border-black uppercase tracking-widest text-xs">
                        <Trash2 size={14} /> Delete Variant
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {error && (
            <div className="text-sm font-bold text-destructive bg-destructive/10 p-4 border border-destructive uppercase tracking-wider">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm font-bold text-emerald-700 bg-emerald-50 p-4 border border-emerald-700 uppercase tracking-wider">
              {success}{" "}
              {!product && (
                <a href={`/${locale}`} className="underline">
                  View storefront
                </a>
              )}
            </div>
          )}

          <Button type="submit" disabled={isPending} className="w-full h-14 rounded-none bg-black text-white hover:bg-slate-900 uppercase tracking-widest font-black text-sm transition-colors">
            {isPending ? "Saving..." : product ? "Save Changes" : "Save Product"}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
