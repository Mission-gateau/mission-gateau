import type { MetadataRoute } from "next";

/**
 * Le site reste invisible des moteurs pendant ce lot : tout est interdit au
 * crawl, et chaque page porte en plus une balise « noindex, nofollow ».
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
