export function formatAccraDate(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleString("en-GB", {
      timeZone: "Africa/Accra",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  } catch {
    return isoString
  }
}

export function formatDate(isoString: string): string {
  try {
    return new Intl.DateTimeFormat("en-GH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Accra",
    }).format(new Date(isoString))
  } catch {
    return isoString
  }
}

export function money(minor: number, currency: string = "GHS"): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
  }).format(minor / 100)
}

export function pesewasToGhs(pesewasStr: string): string {
  const str = pesewasStr.trim()
  if (!/^-?\d+$/.test(str)) {
    throw new Error("Invalid pesewa amount")
  }

  const isNegative = str.startsWith("-")
  const absStr = isNegative ? str.slice(1) : str
  const val = BigInt(absStr)
  const main = val / 100n
  const frac = (val % 100n).toString().padStart(2, "0")
  return `${isNegative ? "−" : ""}GHS ${main.toLocaleString("en-US")}.${frac}`
}
