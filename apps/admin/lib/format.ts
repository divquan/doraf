export function formatMoney(
  value: number | bigint | string,
  currency = "GHS"
): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) / 100)
}

export function formatDateTime(
  value: string,
  timeZone = "Africa/Accra"
): string {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value))
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-GH").format(value)
}

export function ghsToPesewas(value: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim())
  if (!match) return null
  const major = BigInt(match[1] ?? "0")
  const fraction = (match[2] ?? "").padEnd(2, "0")
  return major * 100n + BigInt(fraction || "0")
}
