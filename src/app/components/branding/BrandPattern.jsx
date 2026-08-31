import { cn } from "../ui/utils";
import { useBrand } from "../../../branding/useBrand";

/**
 * Belema scale pattern for dark brand surfaces (sidebar, login).
 * Assets ship on black; screen blend drops the matte on dark green backgrounds.
 *
 * @param {number} [tileSize] - CSS background size in px for a finer repeating tile.
 *   Omit to stretch/cover like the original full-bleed image.
 */
export function BrandPattern({ className, opacity = 0.14, tileSize }) {
  const { brand } = useBrand();
  const pattern = brand.images?.pattern;
  if (!pattern) return null;

  const useTiles = Number.isFinite(tileSize) && tileSize > 0;

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {useTiles ? (
        <div
          className="h-full w-full mix-blend-screen"
          style={{
            opacity,
            backgroundImage: `url(${pattern})`,
            backgroundRepeat: "repeat",
            backgroundSize: `${tileSize}px`,
          }}
        />
      ) : (
        <img
          src={pattern}
          alt=""
          className="h-full w-full scale-110 object-cover mix-blend-screen"
          style={{ opacity }}
        />
      )}
    </div>
  );
}
