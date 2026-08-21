import Image from "next/image";

const HELMET_WATERMARK_URL = "/brand/shadowguard-helmet-watermark-cutout.png";

/**
 * ShadowGuard helmet watermark.
 *
 * The source artwork is preprocessed into a transparent cutout so the
 * page never renders the original black image rectangle.
 */
export function SpartanWatermark() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] flex select-none items-center justify-center print:hidden"
    >
      <Image
        src={HELMET_WATERMARK_URL}
        alt=""
        width={339}
        height={408}
        sizes="68vw"
        className="h-[68vh] max-h-[780px] w-auto max-w-[68vw] object-contain opacity-[0.07] dark:invert dark:opacity-[0.09]"
      />
    </div>
  );
}
