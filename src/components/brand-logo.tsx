import Image from "next/image";
import { cn } from "@/lib/utils";

type Brand = "shadowguard" | "agentguard";

const SHADOWGUARD_HELMET_SRC = "/brand/shadowguard-helmet-watermark-cutout.png";

type Props = {
  brand?: Brand;
  /** Rendered pixel height. Width auto-scales to preserve the 1:1 source. */
  height?: number;
  className?: string;
  priority?: boolean;
};

export function BrandMark({
  className,
  imageClassName,
  priority = false,
}: {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[color:var(--brand)]/70 bg-[color:var(--brand)] shadow-[0_0_18px_rgba(254,110,0,0.22)]",
        className
      )}
    >
      <Image
        src={SHADOWGUARD_HELMET_SRC}
        alt=""
        width={339}
        height={408}
        sizes="32px"
        priority={priority}
        className={cn("h-[74%] w-[74%] object-contain", imageClassName)}
      />
    </span>
  );
}

/**
 * Brand lockup (shield + wordmark). Already includes the product name,
 * so don't render a text label next to it.
 */
export function BrandLogo({
  brand = "shadowguard",
  height = 96,
  className,
  priority = false,
}: Props) {
  const src = brand === "agentguard" ? "/brand/agentguard.png" : "/brand/shadowguard.png";
  const alt = brand === "agentguard" ? "AgentGuard" : "ShadowGuard";
  return (
    <Image
      src={src}
      alt={alt}
      width={height}
      height={height}
      priority={priority}
      className={className}
      style={{ height, width: "auto" }}
    />
  );
}

/**
 * Both product lockups side-by-side with a separator. Use when the
 * dual-product nature of the platform is the point (nav, auth, footer).
 */
export function BrandLockupBoth({
  height = 72,
  priority = false,
  className,
}: {
  height?: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <BrandLogo brand="shadowguard" height={height} priority={priority} />
      <span
        className="font-serif text-2xl leading-none text-slate-300"
        style={{ fontFamily: "var(--font-serif)" }}
        aria-hidden
      >
        +
      </span>
      <BrandLogo brand="agentguard" height={height} priority={priority} />
    </div>
  );
}
