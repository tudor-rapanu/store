"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { logoutFromLocale } from "@/lib/actions/auth";
import { type DisplayCurrency } from "@/lib/currency/preference";
import { CurrencySelector } from "./CurrencySelector";
import { LanguageSelector } from "./LanguageSelector";
import { SearchBar } from "@/components/search/SearchBar";

type CategoryLink = {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
};

type MobileNavMenuProps = {
  locale: "en" | "ro";
  categories: CategoryLink[];
  isLoggedIn: boolean;
  isAdmin: boolean;
  initialCurrency: DisplayCurrency;
};

export function MobileNavMenu({
  locale,
  categories,
  isLoggedIn,
  isAdmin,
  initialCurrency,
}: MobileNavMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const parentCategories = categories.filter((category) => !category.parentId);
  const childCategoriesByParentId = new Map<string, CategoryLink[]>();

  categories.forEach((category) => {
    if (!category.parentId) {
      return;
    }

    childCategoriesByParentId.set(category.parentId, [
      ...(childCategoriesByParentId.get(category.parentId) ?? []),
      category,
    ]);
  });
  const linkClass =
    "block border-b border-slate-200 py-4 text-sm font-bold uppercase tracking-widest transition-colors hover:text-slate-500";
  const childLinkClass =
    "block border-b border-slate-200 py-3 pl-5 text-xs font-bold uppercase tracking-widest text-slate-600 transition-colors hover:text-black";

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 w-10 rounded-none hover:bg-black hover:text-white transition-colors xl:hidden"
          aria-label="Open navigation menu"
        >
          <Menu size={20} strokeWidth={1.5} />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[320px] border-l-black"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle className="text-left text-xl font-black uppercase tracking-tighter">
            Menu
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-1 flex-col">
          <div className="border-b border-black pb-5">
            <SearchBar locale={locale} compact onSearch={() => setIsOpen(false)} />
          </div>

          <nav aria-label="Mobile navigation">
            {!isAdmin && (
              <SheetClose asChild>
                <Link href={`/${locale}/products`} className={linkClass}>
                  Shop
                </Link>
              </SheetClose>
            )}
            {!isAdmin &&
              parentCategories.map((category) => (
                <div key={category.id}>
                  <SheetClose asChild>
                    <Link
                      href={`/${locale}/category/${category.slug}`}
                      className={linkClass}
                    >
                      {category.name}
                    </Link>
                  </SheetClose>
                  {(childCategoriesByParentId.get(category.id) ?? []).map(
                    (subcategory) => (
                      <SheetClose asChild key={subcategory.id}>
                        <Link
                          href={`/${locale}/category/${subcategory.slug}`}
                          className={childLinkClass}
                        >
                          {subcategory.name}
                        </Link>
                      </SheetClose>
                    ),
                  )}
                </div>
              ))}

            {isLoggedIn ? (
              <>
                {isAdmin ? (
                  <>
                    <SheetClose asChild>
                      <Link href={`/${locale}/admin/orders`} className={linkClass}>
                        Orders
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href={`/${locale}/admin/products`} className={linkClass}>
                        Products
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href={`/${locale}/admin/categories`} className={linkClass}>
                        Categories
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href={`/${locale}/admin/discounts`} className={linkClass}>
                        Discounts
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href={`/${locale}/admin/settings`} className={linkClass}>
                        Settings
                      </Link>
                    </SheetClose>
                  </>
                ) : (
                  <>
                    <SheetClose asChild>
                      <Link href={`/${locale}/account`} className={linkClass}>
                        Account
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link href={`/${locale}/account/orders`} className={linkClass}>
                        Orders
                      </Link>
                    </SheetClose>
                  </>
                )}
                {isAdmin && (
                  <SheetClose asChild>
                    <Link href={`/${locale}/account`} className={linkClass}>
                      Account
                    </Link>
                  </SheetClose>
                )}
              </>
            ) : (
              <>
                <SheetClose asChild>
                  <Link href={`/${locale}/login`} className={linkClass}>
                    Login
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href={`/${locale}/register`} className={linkClass}>
                    Register
                  </Link>
                </SheetClose>
              </>
            )}
          </nav>

          <div className="mt-auto space-y-6 border-t border-black pt-6">
            <div className="flex items-center gap-5">
              <LanguageSelector locale={locale} />
              <CurrencySelector initialCurrency={initialCurrency} compact />
            </div>

            {isLoggedIn && (
              <form action={logoutFromLocale}>
                <input type="hidden" name="locale" value={locale} />
                <Button
                  type="submit"
                  className="h-12 w-full uppercase rounded-none bg-black text-white hover:bg-slate-800"
                >
                  Logout
                </Button>
              </form>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
