import "server-only"
import QRCode from "qrcode"

/**
 * Generate a QR code for a URL as a base64 PNG data URL, entirely on the
 * server. The sales link is never sent to a third party. The QR is rendered at
 * a size that scans reliably from a phone screen or printout (useful for
 * offline/print sharing of an agent's permanent store link).
 *
 * Returns null if generation fails so callers can degrade gracefully without
 * throwing during render.
 */
export async function qrDataUrl(
  text: string,
  options: { margin?: number; width?: number } = {}
): Promise<string | null> {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      margin: options.margin ?? 2,
      width: options.width ?? 320,
      color: { dark: "#0b1220", light: "#ffffff" },
    })
  } catch {
    return null
  }
}
