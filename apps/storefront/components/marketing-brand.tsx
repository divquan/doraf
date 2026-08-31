import Image from "next/image"

export function MarketingBrand() {
  return (
    <span className="inline-flex h-8 w-[132px] items-center sm:h-9 sm:w-[150px]">
      <Image
        alt=""
        className="size-full object-contain object-left"
        height={347}
        sizes="(min-width: 640px) 150px, 132px"
        src="/logo.svg"
        width={1127}
      />
    </span>
  )
}
