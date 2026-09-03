import { cn } from "../ui/utils";
import { useBrand } from "../../../branding/useBrand";
import { ETranzactWordmark } from "./ETranzactWordmark";

/**
 * Compact header lockup for the main app bar (light surface).
 * Belema: single-line "Belema Fintech" in brand green for contrast on white.
 * Other brands keep the dark wordmark image on the light header.
 */
export function BrandHeaderLockup({ className }) {
  const { brand } = useBrand();
  const green = brand.palette?.brandGreen || brand.theme?.loginPrimary || "#00411A";

  if (brand.id === "belema") {
    return (
      <p
        className={cn(
          "min-w-0 whitespace-nowrap text-[1.65rem] font-bold leading-none tracking-tight sm:text-[1.9rem]",
          className,
        )}
        style={{ color: green }}
        aria-label="Belema Fintech"
      >
        Belema Fintech
      </p>
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
