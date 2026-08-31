import { cn } from "../ui/utils";
import { useBrand } from "../../../branding/useBrand";

/**
 * Brand logo / wordmark. `variant="light"` for dark surfaces; `variant="dark"` for light surfaces.
 * Official PNGs ship on black — use `surface="dark"` (screen blend) on dark panels; `surface="light"` on white headers.
 */
export function ETranzactWordmark({
  className,
  iconClassName,
  textClassName,
  subtitle,
  showSubtitle = false,
  compact = false,
  /** @type {"light" | "dark"} */
  variant = "dark",
  /** @type {"light" | "dark"} Background the logo sits on — controls matte removal blend. */
  surface = "dark",
  markOnly = false,
  blendBlack,
}) {
  const { brand } = useBrand();
  const logos = brand.logos ?? {};
  const useBlend = blendBlack ?? surface === "dark";

  const src = markOnly
    ? variant === "light"
      ? logos.iconLight ?? logos.icon
      : logos.iconDark ?? logos.icon
    : variant === "light"
      ? logos.wordmarkLight ?? logos.wordmark
      : logos.wordmarkDark ?? logos.wordmark;

  const blendClass = useBlend
    ? "mix-blend-screen"
    : surface === "light"
      ? "mix-blend-multiply"
      : "";

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
        src={src}
        alt={logos.alt || brand.displayName}
        className={cn(
          "h-[1em] w-auto max-w-full object-contain object-left",
          compact && "h-[1em]",
          blendClass,
          iconClassName,
        )}
      />
      {showSubtitle ? (
        <p className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-sidebar-accent-foreground">
          {subtitle || brand.productText?.shellSubtitle || brand.tagline}
        </p>
      ) : null}
    </div>
  );
}
