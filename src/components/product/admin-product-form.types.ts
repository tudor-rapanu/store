export type ProductFormProduct = {
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

export type InventorySummary = {
  reserved: number;
  paid: number;
};

export type ProductFormVariant = {
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

export type ProductOptionRow = {
  id: string;
  name: string;
  values: string;
};

export type ProductVariantRow = ProductFormVariant & {
  id: string;
  skuWasEdited: boolean;
};

export type AvailableProductCategory = {
  id: string;
  name: string;
  value: string;
  depth?: number;
};

export type AvailableSizeGuide = {
  id: string;
  title: string;
};

export type ProductDigitalFile = {
  id: string;
  fileName: string;
  fileSize: number;
};

export type ProductDetailBlock = {
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

export type ProductDetailRow = ProductDetailBlock & {
  rowId: string;
};

export type AdminProductFormProps = {
  locale: "en" | "ro";
  product?: ProductFormProduct;
  inventorySummary?: InventorySummary;
  variants?: ProductFormVariant[];
  imagePaths?: string[];
  imageSources?: Record<string, string | null>;
  categories?: string[];
  availableCategories?: AvailableProductCategory[];
  availableSizeGuides?: AvailableSizeGuide[];
  digitalFiles?: ProductDigitalFile[];
  detailBlocks?: ProductDetailBlock[];
};
