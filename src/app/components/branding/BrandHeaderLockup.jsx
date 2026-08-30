import { cn } from "../ui/utils";
import { useBrand } from "../../../branding/useBrand";

/**
 * Compact header lockup for light surfaces: logo mark + brand name.
 * Uses multiply blend so black-matte PNG marks render on white headers.
 */
export function BrandHeaderLockup({ className }) {
  const { brand } = useBrand();
  const logos = brand.logos ?? {};
  const markSrc = logos.iconDark ?? logos.icon;
  const brandGreen = brand.palette?.brandGreen ?? "#00411A";

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      {markSrc ? (
        <img
          src={markSrc}
          alt={logos.alt || brand.displayName}
          className="h-9 w-auto shrink-0 object-contain mix-blend-multiply"
        />
      ) : null}
      <span
        className="truncate text-base font-semibold leading-tight sm:text-lg"
        style={{ color: brandGreen }}
      >
        {brand.displayName}
      </span>
    </div>
  );
}
