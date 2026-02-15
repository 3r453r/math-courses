import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/gallery", "/shared/", "/pricing", "/login"],
        disallow: ["/api/", "/admin", "/setup", "/courses/", "/redeem", "/progress"],
      },
    ],
  };
}
