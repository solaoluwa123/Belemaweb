import { cn } from "../ui/utils";
import { ETranzactWordmark } from "./ETranzactWordmark";

/**
 * Compact header lockup for the main app bar.
 * Uses the brand light wordmark (`logo-light`).
 */
export function BrandHeaderLockup({ className }) {
  return (
    <ETranzactWordmark
      variant="light"
      surface="dark"
      compact
      className={cn("min-w-0 text-[2rem] sm:text-[2.35rem]", className)}
    />
  );
}
