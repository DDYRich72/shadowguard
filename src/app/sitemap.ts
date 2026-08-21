import type { MetadataRoute } from "next";
import { getServerAppUrl } from "@/lib/public-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const baseUrl = getServerAppUrl();
  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
