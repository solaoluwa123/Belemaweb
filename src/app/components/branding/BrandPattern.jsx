import { cn } from "../ui/utils";
import { useBrand } from "../../../branding/useBrand";

/**
 * Subtle Belema scale pattern for dark brand surfaces (sidebar, login hero).
 * Assets ship on black; screen blend drops the matte on dark green backgrounds.
 */
export function BrandPattern({ className, opacity = 0.14 }) {
  const { brand } = useBrand();
  const pattern = brand.images?.pattern;
  if (!pattern) return null;

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <img
        src={pattern}
        alt=""
        className="h-full w-full scale-110 object-cover mix-blend-screen"
        style={{ opacity }}
      />
    </div>
  );
}
