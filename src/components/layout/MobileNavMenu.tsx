"use client";

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

type CategoryLink = {
  slug: string;
  name: string;
};

type MobileNavMenuProps = {
  locale: "en" | "ro";
  categories: CategoryLink[];
  isLoggedIn: boolean;
  isAdmin: boolean;
};

export function MobileNavMenu({
  locale,
  categories,
  isLoggedIn,
  isAdmin,
}: MobileNavMenuProps) {
  const linkClass =
    "block border-b border-slate-200 py-4 text-sm font-bold uppercase tracking-widest transition-colors hover:text-slate-500";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 w-10 rounded-none hover:bg-black hover:text-white transition-colors sm:hidden"
          aria-label="Open navigation menu"
        >
          <Menu size={20} strokeWidth={1.5} />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[320px] border-l-black">
        <SheetHeader>
          <SheetTitle className="text-left text-xl font-black uppercase tracking-tighter">
            Menu
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex flex-1 flex-col">
          <nav aria-label="Mobile navigation">
            {categories.map((category) => (
              <SheetClose asChild key={category.slug}>
                <Link
                  href={`/${locale}/category/${category.slug}`}
                  className={linkClass}
                >
                  {category.name}
                </Link>
              </SheetClose>
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
                      <Link
                        href={`/${locale}/admin/products`}
                        className={linkClass}
                      >
                        Products
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        href={`/${locale}/admin/categories`}
                        className={linkClass}
                      >
                        Categories
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        href={`/${locale}/admin/settings`}
                        className={linkClass}
                      >
                        Settings
                      </Link>
                    </SheetClose>
                  </>
                ) : (
                  <SheetClose asChild>
                    <Link href={`/${locale}/account/orders`} className={linkClass}>
                      Orders
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
            <div className="flex gap-3 text-xs font-bold uppercase tracking-widest">
              <SheetClose asChild>
                <Link href="/en" className="hover:text-slate-500">
                  EN
                </Link>
              </SheetClose>
              <span>/</span>
              <SheetClose asChild>
                <Link href="/ro" className="hover:text-slate-500">
                  RO
                </Link>
              </SheetClose>
            </div>

            {isLoggedIn && (
              <form action={logoutFromLocale}>
                <input type="hidden" name="locale" value={locale} />
                <Button
                  type="submit"
                  className="h-11 w-full rounded-none bg-black text-white hover:bg-slate-800"
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
