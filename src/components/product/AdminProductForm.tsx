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
import { formatRomaniaDateTimeLocal } from "@/lib/dates/romania";
import { getTranslatedText } from "@/lib/i18n/text";
import { PRODUCT_DETAIL_ICONS, getProductDetailIcon } from "@/lib/product-detail-icons";
import { getProductImageSrc } from "@/lib/product-images";

type Product = {
  id: string;
  slug: string;
  title: { en: string; ro: string };
  description?: { en: string; ro: string } | null;
  basePrice: number;
  salePrice?: number | null;
  saleEnabled?: boolean;
  saleStartsAt?: Date | string | null;
  saleEndsAt?: Date | string | null;
  productionMinDays?: number | null;
  productionMaxDays?: number | null;
  preorderEnabled?: boolean;
  preorderShipDate?: Date | string | null;
  publishAt?: Date | string | null;
  isDigital?: boolean;
  sizeGuideId?: string | null;
  trackStock?: boolean;
  stock?: number;
  isPrivate?: boolean;
};

type Variant = {
  dbId?: string;
  name: string;
  sku: string;
  attributes: Record<string, string>;
  price: number;
  salePrice?: number | null;
  saleEnabled?: boolean;
  saleStartsAt?: Date | string | null;
  saleEndsAt?: Date | string | null;
  trackStock?: boolean;
  stock: number;
  inventorySummary?: InventorySummary;
};

type InventorySummary = {
  reserved: number;
  paid: number;
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
  depth?: number;
};

type AvailableSizeGuide = {
  id: string;
  title: string;
};

type DigitalFile = {
  id: string;
  fileName: string;
  fileSize: number;
};

type ProductDetailBlock = {
  id?: string;
  icon: string;
  label: {
    en: string;
    ro: string;
  };
  value: {
    en: string;
    ro: string;
  };
  enabled: boolean;
};

type ProductDetailRow = ProductDetailBlock & {
  rowId: string;
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

function toDateTimeInputValue(value?: Date | string | null) {
  return formatRomaniaDateTimeLocal(value);
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
  return optionNames.map((name) => `${name}:${attributes[name] ?? ""}`).join("|");
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

function InventorySummaryLine({ summary }: { summary: InventorySummary }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
      Reserved in pending orders: {summary.reserved} / Paid orders: {summary.paid}
    </p>
  );
}

export function AdminProductForm({
  locale,
  product,
  inventorySummary,
  variants = [],
  imagePaths = [],
  imageSources = {},
  categories = [],
  availableCategories = [],
  availableSizeGuides = [],
  digitalFiles = [],
  detailBlocks = [],
}: {
  locale: "en" | "ro";
  product?: Product;
  inventorySummary?: InventorySummary;
  variants?: Variant[];
  imagePaths?: string[];
  imageSources?: Record<string, string | null>;
  categories?: string[];
  availableCategories?: AvailableCategory[];
  availableSizeGuides?: AvailableSizeGuide[];
  digitalFiles?: DigitalFile[];
  detailBlocks?: ProductDetailBlock[];
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
  const [saleEnabled, setSaleEnabled] = useState(product?.saleEnabled ?? false);
  const [salePrice, setSalePrice] = useState(
    product?.salePrice ? (product.salePrice / 100).toFixed(2) : "",
  );
  const [saleStartsAt, setSaleStartsAt] = useState(
    toDateTimeInputValue(product?.saleStartsAt),
  );
  const [saleEndsAt, setSaleEndsAt] = useState(
    toDateTimeInputValue(product?.saleEndsAt),
  );
  const [productionMinDays, setProductionMinDays] = useState(
    String(product?.productionMinDays ?? 1),
  );
  const [productionMaxDays, setProductionMaxDays] = useState(
    String(product?.productionMaxDays ?? 3),
  );
  const [preorderEnabled, setPreorderEnabled] = useState(
    product?.preorderEnabled ?? false,
  );
  const [preorderShipDate, setPreorderShipDate] = useState(
    toDateTimeInputValue(product?.preorderShipDate),
  );
  const [isDigital, setIsDigital] = useState(product?.isDigital ?? false);
  const [trackStock, setTrackStock] = useState(product?.trackStock ?? false);
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [publishAt, setPublishAt] = useState(toDateTimeInputValue(product?.publishAt));
  const [existingImages, setExistingImages] = useState(imagePaths);
  const [selectedCategories, setSelectedCategories] = useState(categories);
  const [variantsEnabled, setVariantsEnabled] = useState(variants.length > 0);
  const [options, setOptions] = useState<OptionRow[]>(() => deriveOptions(variants));
  const [variantRows, setVariantRows] = useState<VariantRow[]>(() =>
    variants.map((variant) => ({
      ...variant,
      id: createId(),
      skuWasEdited: false,
    })),
  );
  const [detailRows, setDetailRows] = useState<ProductDetailRow[]>(() =>
    detailBlocks.map((detail) => ({
      ...detail,
      rowId: createId(),
    })),
  );

  const variantPayload = useMemo(() => {
    if (!variantsEnabled) {
      return "[]";
    }

    return JSON.stringify(
      variantRows.map((variant) => ({
        id: variant.dbId ?? null,
        name: variant.name,
        sku: variant.sku,
        attributes: variant.attributes,
        price: variant.price,
        salePrice: variant.salePrice ?? null,
        saleEnabled: variant.saleEnabled ?? false,
        saleStartsAt: toDateTimeInputValue(variant.saleStartsAt),
        saleEndsAt: toDateTimeInputValue(variant.saleEndsAt),
        trackStock: variant.trackStock ?? false,
        stock: variant.stock,
      })),
    );
  }, [variantRows, variantsEnabled]);
  const detailPayload = useMemo(
    () =>
      JSON.stringify(
        detailRows.map((detail) => ({
          icon: detail.icon,
          label: detail.label,
          value: detail.value,
          enabled: detail.enabled,
        })),
      ),
    [detailRows],
  );
  const categoryPayload = selectedCategories.join(", ");
  const selectedCategoryLabels = selectedCategories.map((categoryValue) => {
    const category = availableCategories.find((item) => item.value === categoryValue);

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

  function addDetailBlock() {
    setDetailRows((current) => [
      ...current,
      {
        rowId: createId(),
        icon: "shirt",
        label: {
          en: "",
          ro: "",
        },
        value: {
          en: "",
          ro: "",
        },
        enabled: true,
      },
    ]);
  }

  function moveDetailBlock(index: number, direction: -1 | 1) {
    setDetailRows((current) => {
      const next = [...current];
      const targetIndex = index + direction;

      if (targetIndex < 0 || targetIndex >= next.length) {
        return current;
      }

      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function updateDetailBlock(
    rowId: string,
    field: "icon" | "enabled",
    value: string | boolean,
  ) {
    setDetailRows((current) =>
      current.map((detail) =>
        detail.rowId === rowId ? { ...detail, [field]: value } : detail,
      ),
    );
  }

  function updateDetailTranslation(
    rowId: string,
    field: "label" | "value",
    language: "en" | "ro",
    value: string,
  ) {
    setDetailRows((current) =>
      current.map((detail) =>
        detail.rowId === rowId
          ? {
              ...detail,
              [field]: {
                ...detail[field],
                [language]: value,
              },
            }
          : detail,
      ),
    );
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
    field: "name" | "sku" | "price" | "stock",
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
        salePrice: null,
        saleEnabled: false,
        saleStartsAt: "",
        saleEndsAt: "",
        trackStock: false,
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

    const missingValues = matrixOptions.find((option) => option.values.length === 0);

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
          salePrice: null,
          saleEnabled: false,
          saleStartsAt: "",
          saleEndsAt: "",
          trackStock: false,
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
    formData.set("productDetails", detailPayload);

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
        setSaleEnabled(false);
        setSalePrice("");
        setSaleStartsAt("");
        setSaleEndsAt("");
        setProductionMinDays("1");
        setProductionMaxDays("3");
        setPreorderEnabled(false);
        setPreorderShipDate("");
        setIsDigital(false);
        setTrackStock(false);
        setStock("0");
        setPublishAt("");
        setVariantsEnabled(false);
        setOptions([]);
        setVariantRows([]);
        setDetailRows([]);
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
        <input type="hidden" name="productDetails" value={detailPayload} readOnly />
        <input type="hidden" name="categories" value={categoryPayload} readOnly />
        <input
          type="hidden"
          name="existingImages"
          value={JSON.stringify(existingImages)}
          readOnly
        />
        <CardContent className="space-y-8 pt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label
                htmlFor="titleEn"
                className="uppercase text-xs font-bold tracking-widest"
              >
                Title (English)
              </Label>
              <Input
                id="titleEn"
                name="titleEn"
                required
                defaultValue={getTranslatedText(product?.title, "en")}
                onChange={(event) => handleTitleChange(event.target.value)}
                className="rounded-none border-black h-12"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="titleRo"
                className="uppercase text-xs font-bold tracking-widest"
              >
                Title (Romanian)
              </Label>
              <Input
                id="titleRo"
                name="titleRo"
                required
                defaultValue={getTranslatedText(product?.title, "ro")}
                className="rounded-none border-black h-12"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label
                htmlFor="descriptionEn"
                className="uppercase text-xs font-bold tracking-widest"
              >
                Description (English)
              </Label>
              <textarea
                id="descriptionEn"
                name="descriptionEn"
                rows={5}
                defaultValue={product?.description?.en ?? ""}
                className="w-full rounded-none border border-black bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="descriptionRo"
                className="uppercase text-xs font-bold tracking-widest"
              >
                Description (Romanian)
              </Label>
              <textarea
                id="descriptionRo"
                name="descriptionRo"
                rows={5}
                defaultValue={product?.description?.ro ?? ""}
                className="w-full rounded-none border border-black bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label
                htmlFor="slug"
                className="uppercase text-xs font-bold tracking-widest"
              >
                URL Slug
              </Label>
              <Input
                id="slug"
                name="slug"
                required
                value={slug}
                onChange={(event) => handleSlugChange(event.target.value)}
                className="rounded-none border-black h-12"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="price"
                className="uppercase text-xs font-bold tracking-widest"
              >
                Base Price (RON)
              </Label>
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                required
                value={basePrice}
                onChange={(event) => setBasePrice(event.target.value)}
                className="rounded-none border-black h-12"
              />
            </div>
          </div>

          <section className="space-y-4 border border-black p-4">
            <label className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
              <input
                type="checkbox"
                name="saleEnabled"
                checked={saleEnabled}
                onChange={(event) => setSaleEnabled(event.target.checked)}
                className="size-4"
              />
              Enable product sale price
            </label>
            {saleEnabled && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label
                    htmlFor="salePrice"
                    className="uppercase text-xs font-bold tracking-widest"
                  >
                    Sale Price (RON)
                  </Label>
                  <Input
                    id="salePrice"
                    name="salePrice"
                    type="number"
                    step="0.01"
                    value={salePrice}
                    onChange={(event) => setSalePrice(event.target.value)}
                    className="rounded-none border-black h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="saleStartsAt"
                    className="uppercase text-xs font-bold tracking-widest"
                  >
                    Starts At
                  </Label>
                  <Input
                    id="saleStartsAt"
                    name="saleStartsAt"
                    type="datetime-local"
                    value={saleStartsAt}
                    onChange={(event) => setSaleStartsAt(event.target.value)}
                    className="rounded-none border-black h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="saleEndsAt"
                    className="uppercase text-xs font-bold tracking-widest"
                  >
                    Ends At
                  </Label>
                  <Input
                    id="saleEndsAt"
                    name="saleEndsAt"
                    type="datetime-local"
                    value={saleEndsAt}
                    onChange={(event) => setSaleEndsAt(event.target.value)}
                    className="rounded-none border-black h-12"
                  />
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4 border border-black p-4">
            <label className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
              <input
                type="checkbox"
                name="isDigital"
                checked={isDigital}
                onChange={(event) => setIsDigital(event.target.checked)}
                className="size-4"
              />
              Digital downloadable product
            </label>
            {isDigital && (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-widest text-slate-500">
                  Digital products have no shipping cost or fulfillment estimate. Files
                  are only downloadable after payment.
                </p>
                {digitalFiles.length > 0 && (
                  <div className="divide-y divide-slate-200 border border-slate-200">
                    {digitalFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between gap-4 p-3 text-sm"
                      >
                        <span className="font-bold uppercase tracking-wider">
                          {file.fileName}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                          {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <Label
                    htmlFor="digitalFiles"
                    className="uppercase text-xs font-bold tracking-widest"
                  >
                    Protected Files
                  </Label>
                  <Input
                    id="digitalFiles"
                    name="digitalFiles"
                    type="file"
                    multiple
                    className="rounded-none border-black h-12"
                  />
                </div>
              </div>
            )}
          </section>

          {!variantsEnabled && (
            <section className="space-y-4 border border-black p-4">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest">
                  Product Stock
                </h2>
                <p className="text-xs uppercase tracking-widest text-slate-500">
                  Leave stock tracking disabled for permanent or made-to-order products.
                </p>
              </div>
              <label className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
                <input
                  type="checkbox"
                  name="trackStock"
                  checked={trackStock}
                  onChange={(event) => setTrackStock(event.target.checked)}
                  className="size-4"
                />
                Track stock for this product
              </label>
              {trackStock && (
                <div className="space-y-2">
                  <Label
                    htmlFor="stock"
                    className="uppercase text-xs font-bold tracking-widest"
                  >
                    Available Stock
                  </Label>
                  <Input
                    id="stock"
                    name="stock"
                    type="number"
                    min={0}
                    step={1}
                    value={stock}
                    onChange={(event) => setStock(event.target.value)}
                    className="rounded-none border-black h-12"
                  />
                  {inventorySummary && (
                    <InventorySummaryLine summary={inventorySummary} />
                  )}
                </div>
              )}
            </section>
          )}

          <section className="space-y-4 border border-black p-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">
                Fulfillment Estimate
              </h2>
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Used to estimate shipping dates in checkout and order emails.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="productionMinDays"
                  className="uppercase text-xs font-bold tracking-widest"
                >
                  Minimum Business Days
                </Label>
                <Input
                  id="productionMinDays"
                  name="productionMinDays"
                  type="number"
                  min={1}
                  step={1}
                  value={productionMinDays}
                  onChange={(event) => setProductionMinDays(event.target.value)}
                  className="rounded-none border-black h-12"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="productionMaxDays"
                  className="uppercase text-xs font-bold tracking-widest"
                >
                  Maximum Business Days
                </Label>
                <Input
                  id="productionMaxDays"
                  name="productionMaxDays"
                  type="number"
                  min={1}
                  step={1}
                  value={productionMaxDays}
                  onChange={(event) => setProductionMaxDays(event.target.value)}
                  className="rounded-none border-black h-12"
                />
              </div>
            </div>
            <label className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
              <input
                type="checkbox"
                name="preorderEnabled"
                checked={preorderEnabled}
                onChange={(event) => setPreorderEnabled(event.target.checked)}
                className="size-4"
              />
              Enable preorder
            </label>
            {preorderEnabled && (
              <div className="space-y-2">
                <Label
                  htmlFor="preorderShipDate"
                  className="uppercase text-xs font-bold tracking-widest"
                >
                  Shipping Starts From
                </Label>
                <Input
                  id="preorderShipDate"
                  name="preorderShipDate"
                  type="datetime-local"
                  value={preorderShipDate}
                  onChange={(event) => setPreorderShipDate(event.target.value)}
                  className="rounded-none border-black h-12"
                />
              </div>
            )}
          </section>

          <section className="space-y-4 border border-black p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest">
                  Product Details
                </h2>
                <p className="text-xs uppercase tracking-widest text-slate-500">
                  Optional highlights shown on the product page with selectable icons.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addDetailBlock}
                className="h-9 rounded-none border-black uppercase tracking-widest text-xs"
              >
                <Plus size={14} /> Detail
              </Button>
            </div>

            {detailRows.length === 0 ? (
              <p className="border border-dashed border-slate-300 p-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                No product details added yet.
              </p>
            ) : (
              <div className="space-y-2">
                {detailRows.map((detail, index) => {
                  const DetailIcon = getProductDetailIcon(detail.icon);

                  return (
                    <div key={detail.rowId} className="border border-slate-200 p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-black">
                          <DetailIcon size={16} />
                        </span>
                        <select
                          value={detail.icon}
                          onChange={(event) =>
                            updateDetailBlock(detail.rowId, "icon", event.target.value)
                          }
                          aria-label="Detail icon"
                          className="h-9 w-36 rounded-none border border-black bg-white px-2 text-sm"
                        >
                          {PRODUCT_DETAIL_ICONS.map((icon) => (
                            <option key={icon.key} value={icon.key}>
                              {icon.label}
                            </option>
                          ))}
                        </select>
                        <label className="flex h-9 items-center gap-2 border border-black px-2 text-[10px] font-black uppercase tracking-widest">
                          <input
                            type="checkbox"
                            checked={detail.enabled}
                            onChange={(event) =>
                              updateDetailBlock(
                                detail.rowId,
                                "enabled",
                                event.target.checked,
                              )
                            }
                            className="size-4"
                          />
                          Show
                        </label>
                        <Input
                          value={detail.label.en}
                          onChange={(event) =>
                            updateDetailTranslation(
                              detail.rowId,
                              "label",
                              "en",
                              event.target.value,
                            )
                          }
                          placeholder="Label EN"
                          aria-label="Detail label in English"
                          className="h-9 min-w-32 flex-1 rounded-none border-black"
                        />
                        <Input
                          value={detail.label.ro}
                          onChange={(event) =>
                            updateDetailTranslation(
                              detail.rowId,
                              "label",
                              "ro",
                              event.target.value,
                            )
                          }
                          placeholder="Label RO"
                          aria-label="Detail label in Romanian"
                          className="h-9 min-w-32 flex-1 rounded-none border-black"
                        />
                        <Input
                          value={detail.value.en}
                          onChange={(event) =>
                            updateDetailTranslation(
                              detail.rowId,
                              "value",
                              "en",
                              event.target.value,
                            )
                          }
                          placeholder="Value EN"
                          aria-label="Detail value in English"
                          className="h-9 min-w-40 flex-1 rounded-none border-black"
                        />
                        <Input
                          value={detail.value.ro}
                          onChange={(event) =>
                            updateDetailTranslation(
                              detail.rowId,
                              "value",
                              "ro",
                              event.target.value,
                            )
                          }
                          placeholder="Value RO"
                          aria-label="Detail value in Romanian"
                          className="h-9 min-w-40 flex-1 rounded-none border-black"
                        />
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => moveDetailBlock(index, -1)}
                            className="h-9 w-9 rounded-none border-black"
                            aria-label="Move detail up"
                          >
                            <ArrowUp size={14} />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => moveDetailBlock(index, 1)}
                            className="h-9 w-9 rounded-none border-black"
                            aria-label="Move detail down"
                          >
                            <ArrowDown size={14} />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              setDetailRows((current) =>
                                current.filter((item) => item.rowId !== detail.rowId),
                              )
                            }
                            className="h-9 w-9 rounded-none border-black"
                            aria-label="Delete detail"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="space-y-2">
            <Label className="uppercase text-xs font-bold tracking-widest">
              Categories
            </Label>
            <details className="group relative">
              <summary className="flex h-12 cursor-pointer list-none items-center justify-between border border-black px-3 text-sm [&::-webkit-details-marker]:hidden">
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
                        style={{
                          paddingLeft: `${(category.depth ?? 0) * 16}px`,
                        }}
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

          <section className="space-y-3 border border-black p-4">
            <div>
              <Label
                htmlFor="publishAt"
                className="uppercase text-xs font-bold tracking-widest"
              >
                Publish Date
              </Label>
              <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">
                Romanian time. Leave empty to publish immediately unless private.
              </p>
            </div>
            <Input
              id="publishAt"
              name="publishAt"
              type="datetime-local"
              value={publishAt}
              onChange={(event) => setPublishAt(event.target.value)}
              className="rounded-none border-black h-12"
            />
          </section>

          <section className="space-y-3 border border-black p-4">
            <div>
              <Label
                htmlFor="sizeGuideId"
                className="uppercase text-xs font-bold tracking-widest"
              >
                Size Guide
              </Label>
              <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">
                Optional reusable measurement table for clothing products.
              </p>
            </div>
            <select
              id="sizeGuideId"
              name="sizeGuideId"
              defaultValue={product?.sizeGuideId ?? ""}
              className="h-12 w-full rounded-none border border-black bg-white px-3 text-sm"
            >
              <option value="">No size guide</option>
              {availableSizeGuides.map((guide) => (
                <option key={guide.id} value={guide.id}>
                  {guide.title}
                </option>
              ))}
            </select>
          </section>

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
                  const src = imageSources[imagePath] ?? getProductImageSrc(imagePath);

                  return (
                    <div key={imagePath} className="space-y-2">
                      <div className="relative aspect-square overflow-hidden border border-slate-200 bg-white">
                        {src && (
                          <Image
                            src={src}
                            alt=""
                            fill
                            unoptimized
                            className="object-contain p-2"
                          />
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => moveImage(index, -1)}
                          className="rounded-none border-black"
                          aria-label="Move image up"
                        >
                          <ArrowUp size={14} />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => moveImage(index, 1)}
                          className="rounded-none border-black"
                          aria-label="Move image down"
                        >
                          <ArrowDown size={14} />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            setExistingImages((current) =>
                              current.filter((path) => path !== imagePath),
                            )
                          }
                          className="rounded-none border-black"
                          aria-label="Delete image"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Input
              id="images"
              name="images"
              type="file"
              accept="image/png, image/jpeg, image/webp"
              multiple
              required={!product && existingImages.length === 0}
              className="rounded-none border-black"
            />
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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setOptions((current) => [
                          ...current,
                          { id: createId(), name: "", values: "" },
                        ])
                      }
                      className="h-9 rounded-none border-black uppercase tracking-widest text-xs"
                    >
                      <Plus size={14} /> Type
                    </Button>
                  </div>
                  {options.map((option) => (
                    <div
                      key={option.id}
                      className="grid gap-2 md:grid-cols-[180px_1fr_auto]"
                    >
                      <Input
                        value={option.name}
                        onChange={(event) =>
                          updateOption(option.id, "name", event.target.value)
                        }
                        placeholder="size"
                        className="rounded-none border-black h-10"
                      />
                      <Input
                        value={option.values}
                        onChange={(event) =>
                          updateOption(option.id, "values", event.target.value)
                        }
                        placeholder="S, M, L"
                        className="rounded-none border-black h-10"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setOptions((current) =>
                            current.filter((item) => item.id !== option.id),
                          )
                        }
                        className="rounded-none border-black"
                        aria-label="Delete variant type"
                      >
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
                      <Button
                        type="button"
                        variant="outline"
                        onClick={generateVariantMatrix}
                        className="h-9 rounded-none border-black uppercase tracking-widest text-xs"
                      >
                        Generate Matrix
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addVariant}
                        className="h-9 rounded-none border-black uppercase tracking-widest text-xs"
                      >
                        <Plus size={14} /> Variant
                      </Button>
                    </div>
                  </div>
                  {variantRows.map((variant) => (
                    <div key={variant.id} className="border border-slate-200 p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={variant.name}
                          onChange={(event) =>
                            updateVariant(variant.id, "name", event.target.value)
                          }
                          placeholder="Black / Medium"
                          className="h-9 min-w-44 flex-1 rounded-none border-black"
                        />
                        <Input
                          value={variant.sku}
                          onChange={(event) =>
                            updateVariant(variant.id, "sku", event.target.value)
                          }
                          placeholder="SKU"
                          className="h-9 w-36 rounded-none border-black"
                        />
                        <Input
                          value={variant.price}
                          onChange={(event) =>
                            updateVariant(variant.id, "price", event.target.value)
                          }
                          type="number"
                          step="0.01"
                          placeholder="Price RON"
                          className="h-9 w-28 rounded-none border-black"
                        />
                        <label className="flex h-9 items-center gap-2 border border-black px-2 text-[10px] font-black uppercase tracking-widest">
                          <input
                            type="checkbox"
                            checked={variant.trackStock ?? false}
                            onChange={(event) =>
                              setVariantRows((current) =>
                                current.map((item) =>
                                  item.id === variant.id
                                    ? {
                                        ...item,
                                        trackStock: event.target.checked,
                                      }
                                    : item,
                                ),
                              )
                            }
                            className="size-4"
                          />
                          Track stock
                        </label>
                        <Input
                          value={variant.stock}
                          onChange={(event) =>
                            updateVariant(variant.id, "stock", event.target.value)
                          }
                          type="number"
                          min={0}
                          step={1}
                          placeholder="Stock"
                          disabled={!variant.trackStock}
                          className="h-9 w-24 rounded-none border-black disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        {variant.trackStock && variant.inventorySummary && (
                          <div className="flex h-9 items-center border border-slate-200 px-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Reserved {variant.inventorySummary.reserved} / Paid{" "}
                            {variant.inventorySummary.paid}
                          </div>
                        )}
                        <label className="flex h-9 items-center gap-2 border border-black px-2 text-[10px] font-black uppercase tracking-widest">
                          <input
                            type="checkbox"
                            checked={variant.saleEnabled ?? false}
                            onChange={(event) =>
                              setVariantRows((current) =>
                                current.map((item) =>
                                  item.id === variant.id
                                    ? {
                                        ...item,
                                        saleEnabled: event.target.checked,
                                      }
                                    : item,
                                ),
                              )
                            }
                            className="size-4"
                          />
                          Sale
                        </label>
                        <Input
                          value={variant.salePrice ?? ""}
                          onChange={(event) =>
                            setVariantRows((current) =>
                              current.map((item) =>
                                item.id === variant.id
                                  ? {
                                      ...item,
                                      salePrice:
                                        event.target.value === ""
                                          ? null
                                          : Number(event.target.value),
                                    }
                                  : item,
                              ),
                            )
                          }
                          type="number"
                          step="0.01"
                          placeholder="Sale RON"
                          disabled={!variant.saleEnabled}
                          className="h-9 w-28 rounded-none border-black disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        {variant.saleEnabled && (
                          <>
                            <Input
                              value={
                                variant.saleStartsAt ? String(variant.saleStartsAt) : ""
                              }
                              onChange={(event) =>
                                setVariantRows((current) =>
                                  current.map((item) =>
                                    item.id === variant.id
                                      ? {
                                          ...item,
                                          saleStartsAt: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              type="datetime-local"
                              className="h-9 w-44 rounded-none border-black"
                            />
                            <Input
                              value={
                                variant.saleEndsAt ? String(variant.saleEndsAt) : ""
                              }
                              onChange={(event) =>
                                setVariantRows((current) =>
                                  current.map((item) =>
                                    item.id === variant.id
                                      ? {
                                          ...item,
                                          saleEndsAt: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              type="datetime-local"
                              className="h-9 w-44 rounded-none border-black"
                            />
                          </>
                        )}
                        {options
                          .filter((option) => option.name.trim())
                          .map((option) => (
                            <label key={option.id} className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
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
                                className="h-9 w-32 rounded-none border border-black bg-white px-2 text-sm"
                              >
                                {splitValues(option.values).map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            setVariantRows((current) =>
                              current.filter((item) => item.id !== variant.id),
                            )
                          }
                          className="h-9 w-9 rounded-none border-black"
                          aria-label="Delete variant"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
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

          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-14 rounded-none bg-black text-white hover:bg-slate-900 uppercase tracking-widest font-black text-sm transition-colors"
          >
            {isPending ? "Saving..." : product ? "Save Changes" : "Save Product"}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
