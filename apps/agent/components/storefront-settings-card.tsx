"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { StoreVerifiedIcon } from "@hugeicons/core-free-icons"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

export interface StorefrontSettings {
  publicId: string
  slug: string | null
  webSalesId: string
  subdomainUrl: string
  storeName: string | null
  tagline: string | null
  logoUrl: string | null
  bannerUrl: string | null
  whatsappNumber: string | null
  themePreset: string | null
  announcement: string | null
}

export function StorefrontSettingsCard({
  initialSettings,
  readOnly,
}: {
  initialSettings: StorefrontSettings
  readOnly: boolean
}) {
  const [settings, setSettings] = useState(initialSettings)
  const [slug, setSlug] = useState(initialSettings.slug || "")
  const [storeName, setStoreName] = useState(initialSettings.storeName || "")
  const [tagline, setTagline] = useState(initialSettings.tagline || "")
  const [logoUrl, setLogoUrl] = useState(initialSettings.logoUrl || "")
  const [bannerUrl, setBannerUrl] = useState(initialSettings.bannerUrl || "")
  const [whatsappNumber, setWhatsappNumber] = useState(initialSettings.whatsappNumber || "")
  const [announcement, setAnnouncement] = useState(initialSettings.announcement || "")
  const [themePreset, setThemePreset] = useState(initialSettings.themePreset || "default")

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/agent-auth/storefront", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: slug.trim() || undefined,
          storeName: storeName.trim() || undefined,
          tagline: tagline.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
          bannerUrl: bannerUrl.trim() || undefined,
          whatsappNumber: whatsappNumber.trim() || undefined,
          themePreset: themePreset.trim() || "default",
          announcement: announcement.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        const message = Array.isArray(data.message)
          ? data.message.join(". ")
          : data.message || "Failed to update storefront settings."
        throw new Error(message)
      }

      const updated = (await response.json()) as StorefrontSettings
      setSettings(updated)
      setSuccess("Storefront settings updated successfully!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.")
    } finally {
      setSaving(false)
    }
  }

  const currentSlugDisplay = slug || settings.slug || settings.webSalesId

  return (
    <Card className="border-border/75 bg-card shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HugeiconsIcon icon={StoreVerifiedIcon} strokeWidth={1.8} />
          </span>
          <div>
            <CardTitle>Storefront Customization</CardTitle>
            <CardDescription>
              Personalize your store link, brand name, logo, banner, and WhatsApp support contact.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-5">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Update failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {success ? (
            <Alert className="border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="slug">Custom Subdomain Slug</Label>
            <div className="flex items-center rounded-md border border-input px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring">
              <span className="text-muted-foreground select-none">https://</span>
              <input
                id="slug"
                disabled={readOnly || saving}
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder={settings.webSalesId}
                className="w-full bg-transparent px-1 font-mono font-medium outline-none placeholder:text-muted-foreground/60"
              />
              <span className="text-muted-foreground select-none">.doraf.app</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Your store URL: <code className="font-mono text-primary">https://{currentSlugDisplay}.doraf.app</code>
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="storeName">Business / Store Name</Label>
              <Input
                id="storeName"
                disabled={readOnly || saving}
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. Kofi's Result Hub"
                maxLength={60}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tagline">Slogan / Tagline</Label>
              <Input
                id="tagline"
                disabled={readOnly || saving}
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Instant WAEC Checkers 24/7"
                maxLength={120}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo Image URL</Label>
              <Input
                id="logoUrl"
                disabled={readOnly || saving}
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bannerUrl">Store Hero Banner URL</Label>
              <Input
                id="bannerUrl"
                disabled={readOnly || saving}
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="https://..."
                maxLength={255}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="whatsappNumber">WhatsApp Help Number</Label>
              <Input
                id="whatsappNumber"
                disabled={readOnly || saving}
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="e.g. 233241234567"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                Adds a floating WhatsApp button to your store so buyers can contact you.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="announcement">Announcement Ticker Banner</Label>
              <Input
                id="announcement"
                disabled={readOnly || saving}
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="e.g. 📢 2026 WASSCE checkers available now!"
                maxLength={200}
              />
            </div>
          </div>

          <Button type="submit" disabled={readOnly || saving} className="w-full sm:w-auto">
            {saving ? "Saving Changes..." : "Save Storefront Settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
