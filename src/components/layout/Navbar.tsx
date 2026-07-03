import Link from "next/link";
import { CartSheet } from "./CartSheet";
import { CurrencySelector } from "./CurrencySelector";
import { LanguageSelector } from "./LanguageSelector";
import { MobileNavMenu } from "./MobileNavMenu";
import { PostHogIdentifier } from "./PostHogIdentifier";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { logoutFromLocale } from "@/lib/actions/auth";
import { isAdminUserRecord } from "@/lib/auth/roles";
import { getCurrencyPresentation } from "@/lib/currency/display";
import { readEnvValue } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function Navbar({ locale }: { locale: "en" | "ro" }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminEmail = readEnvValue(process.env.ADMIN_EMAIL, "ADMIN_EMAIL");
  const isAdmin = isAdminUserRecord(user, adminEmail);
  const [categoryLinks, currencyPresentation] = await Promise.all([
    getCategoryLinks(locale),
    getCurrencyPresentation(),
  ]);

  return (
    <>
      {user?.email && <PostHogIdentifier email={user.email} />}
      <nav className="border-b border-slate-200 sticky top-0 bg-white z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link
            href={`/${locale}`}
            className="flex min-w-0 items-center gap-2 text-lg font-black tracking-tighter uppercase sm:text-2xl"
          >
            <span
              aria-hidden="true"
              className="h-7 w-[1.9rem] shrink-0 bg-current sm:h-8 sm:w-[2.18rem]"
              style={{
                mask: "url('/tt-logo.svg') center / contain no-repeat",
                WebkitMask: "url('/tt-logo.svg') center / contain no-repeat",
              }}
            />
            <span className="truncate">Todd&apos;s Threads</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            {!isAdmin && (
              <div className="hidden lg:flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
                <Link
                  href={`/${locale}/products`}
                  className="hover:text-slate-500 transition-colors"
                >
                  Shop
                </Link>
                {categoryLinks.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/${locale}/category/${category.slug}`}
                    className="hover:text-slate-500 transition-colors"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            )}
            <div className="hidden sm:flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
              {user ? (
                <>
                  {isAdmin && (
                    <>
                      <Link
                        href={`/${locale}/admin/orders`}
                        className="hover:text-slate-500 transition-colors"
                      >
                        Orders
                      </Link>
                      <Link
                        href={`/${locale}/admin/products`}
                        className="hover:text-slate-500 transition-colors"
                      >
                        Products
                      </Link>
                      <Link
                        href={`/${locale}/admin/categories`}
                        className="hover:text-slate-500 transition-colors"
                      >
                        Categories
                      </Link>
                      <Link
                        href={`/${locale}/admin/settings`}
                        className="hover:text-slate-500 transition-colors"
                      >
                        Settings
                      </Link>
                    </>
                  )}
                  <Link
                    href={`/${locale}/account`}
                    className="hover:text-slate-500 transition-colors"
                  >
                    Account
                  </Link>
                  {!isAdmin && (
                    <Link
                      href={`/${locale}/account/orders`}
                      className="hover:text-slate-500 transition-colors"
                    >
                      Orders
                    </Link>
                  )}
                  <form action={logoutFromLocale}>
                    <input type="hidden" name="locale" value={locale} />
                    <button
                      type="submit"
                      className="border border-black px-3 py-2 uppercase hover:bg-black hover:text-white transition-colors"
                    >
                      Logout
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link
                    href={`/${locale}/login`}
                    className="hover:text-slate-500 transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    href={`/${locale}/register`}
                    className="border border-black px-3 py-2 uppercase hover:bg-black hover:text-white transition-colors"
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
            <div className="hidden sm:block">
              <LanguageSelector locale={locale} />
            </div>
            <div className="hidden sm:block">
              <CurrencySelector
                initialCurrency={currencyPresentation.displayCurrency}
                compact
              />
            </div>
            <CartSheet locale={locale} />
            <MobileNavMenu
              locale={locale}
              categories={categoryLinks}
              isLoggedIn={Boolean(user)}
              isAdmin={isAdmin}
              initialCurrency={currencyPresentation.displayCurrency}
            />
          </div>
        </div>
      </nav>
    </>
  );
}

async function getCategoryLinks(locale: "en" | "ro") {
  try {
    const items = await db.select().from(categories);

    return items.map((category) => ({
      slug: category.slug,
      name: category.name[locale] || category.name.en,
    }));
  } catch {
    return [];
  }
}
