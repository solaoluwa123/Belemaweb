import { cn } from "../ui/utils";
import { useBrand } from "../../../branding/useBrand";
import { ETranzactWordmark } from "./ETranzactWordmark";

/**
 * Compact header lockup for the main app bar (light surface).
 * Belema matches the login hero: stacked "Belema" + "Fintech" wordmark.
 * Other brands keep the dark wordmark image on the light header.
 */
export function BrandHeaderLockup({ className }) {
  const { brand } = useBrand();
  const lime = brand.palette?.lime || brand.theme?.sidebarPrimary || "#CEF445";
  const green = brand.palette?.brandGreen || brand.theme?.loginPrimary || "#00411A";

  if (brand.id === "belema") {
    return (
      <div
        className={cn("min-w-0 leading-none tracking-tight", className)}
        aria-label="Belema Fintech"
      >
        <span className="block text-[1.35rem] font-semibold sm:text-[1.6rem]" style={{ color: green }}>
          Belema
        </span>
        <span
          className="mt-0.5 block text-[1.35rem] font-light tracking-[0.04em] sm:text-[1.6rem]"
          style={{ color: lime }}
        >
          Fintech
        </span>
      </div>
    );
  }

  return (
    <ETranzactWordmark
      variant="dark"
      surface="light"
      compact
      className={cn("min-w-0 text-[2rem] sm:text-[2.35rem]", className)}
    />
  );
}
