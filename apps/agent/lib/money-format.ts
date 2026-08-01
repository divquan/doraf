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
