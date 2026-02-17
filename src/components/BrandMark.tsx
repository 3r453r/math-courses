/* eslint-disable @next/next/no-img-element */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/icon-192.png"
      alt=""
      width={size}
      height={size}
      className={className ?? ""}
      aria-hidden="true"
    />
  );
}
