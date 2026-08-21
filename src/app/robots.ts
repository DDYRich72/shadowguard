import type { MetadataRoute } from "next";
import { getServerAppUrl } from "@/lib/public-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getServerAppUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/login", "/signup", "/auth/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
