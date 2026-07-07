import {
  BadgeCheck,
  Clock,
  Download,
  Droplets,
  Info,
  Leaf,
  Package,
  Palette,
  Ruler,
  Scale,
  Scissors,
  Shirt,
  Sparkles,
  WashingMachine,
  type LucideIcon,
} from "lucide-react";

export const PRODUCT_DETAIL_ICONS = [
  { key: "shirt", label: "Fabric", icon: Shirt },
  { key: "washing-machine", label: "Washing", icon: WashingMachine },
  { key: "ruler", label: "Measurements", icon: Ruler },
  { key: "scale", label: "Density / weight", icon: Scale },
  { key: "sparkles", label: "Finish", icon: Sparkles },
  { key: "scissors", label: "Technique", icon: Scissors },
  { key: "leaf", label: "Sustainability", icon: Leaf },
  { key: "palette", label: "Color", icon: Palette },
  { key: "package", label: "Packaging", icon: Package },
  { key: "download", label: "Download", icon: Download },
  { key: "clock", label: "Timing", icon: Clock },
  { key: "droplets", label: "Care", icon: Droplets },
  { key: "badge-check", label: "Quality", icon: BadgeCheck },
  { key: "info", label: "Info", icon: Info },
] as const;

export type ProductDetailIconKey = (typeof PRODUCT_DETAIL_ICONS)[number]["key"];

const productDetailIconMap = PRODUCT_DETAIL_ICONS.reduce<
  Record<string, LucideIcon>
>((icons, icon) => {
  icons[icon.key] = icon.icon;
  return icons;
}, {});

export function getProductDetailIcon(iconKey: string | null | undefined) {
  return productDetailIconMap[iconKey ?? ""] ?? Info;
}
