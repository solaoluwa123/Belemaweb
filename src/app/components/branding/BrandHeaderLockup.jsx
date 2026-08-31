import { cn } from "../ui/utils";
import { ETranzactWordmark } from "./ETranzactWordmark";

/**
 * Compact header lockup for the main app bar (light `bg-card` surface).
 * Uses the brand wordmark PNG suited for light backgrounds.
 */
export function BrandHeaderLockup({ className }) {
  return (
    <ETranzactWordmark
      variant="dark"
      surface="light"
      compact
      className={cn("min-w-0 text-[1.35rem] sm:text-[1.5rem]", className)}
    />
  );
}
