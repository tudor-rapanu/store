import type { MetadataRoute } from "next";
import { headers } from "next/headers";

const PRODUCTION_HOSTS = new Set(["toddsthreads.com", "www.toddsthreads.com"]);

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? "";

  if (!PRODUCTION_HOSTS.has(host)) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/*/admin"],
    },
    sitemap: "https://toddsthreads.com/sitemap.xml",
  };
}
