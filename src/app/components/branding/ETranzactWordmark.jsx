import { cn } from "../ui/utils";
import { useBrand } from "../../../branding/useBrand";

export function ETranzactWordmark({
  className,
  iconClassName,
  textClassName,
  subtitle,
  showSubtitle = false,
  compact = false,
}) {
  const { brand } = useBrand();

  return (
    <div
      className={cn(
        "inline-flex flex-col",
        compact ? "text-[1.8rem]" : "text-[2.75rem] md:text-[3.2rem]",
        textClassName,
        className,
      )}
    >
      <img
        src={brand.logos.wordmark}
        alt={brand.logos.alt || brand.displayName}
        className={cn("h-[1em] w-auto object-contain", compact && "h-[0.95em]", iconClassName)}
      />
      {showSubtitle ? (
        <p className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-sidebar-accent-foreground">
          {subtitle || brand.displayName}
        </p>
      ) : null}
    </div>
  );
}