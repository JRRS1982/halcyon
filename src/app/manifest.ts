import type { MetadataRoute } from "next";

// Web app manifest — makes "Add to Home Screen" install Balanced Money as a
// standalone app (own icon, no browser chrome). Icons are generated from
// src/app/icon.svg by scripts/generate-icons.mjs.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Balanced Money",
    short_name: "Balanced",
    description: "See where your money went, then plan where it goes next.",
    start_url: "/",
    display: "standalone",
    background_color: "#FCEEE2",
    theme_color: "#FCEEE2",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
