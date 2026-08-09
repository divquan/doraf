"use client"

import { useState, useRef, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Comment01Icon,
  Copy01Icon,
  Download04Icon,
  Edit02Icon,
  ImageAdd01Icon,
  Link01Icon,
  Megaphone01Icon,
  QrCode01Icon,
  StoreVerifiedIcon,
  Upload01Icon,
  ViewIcon,
  ArrowUpRight01Icon,
} from "@hugeicons/core-free-icons"
import Link from "next/link"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Dialog, DialogPopup, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { money } from "@workspace/ui/lib/format"
import { cn } from "@workspace/ui/lib/utils"
import { type AgentPricingRow } from "@/components/pricing-grid"
import { getStorefrontConfig } from "@/lib/storefront-url"

export interface StorefrontData {
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

export function StoreEditor({
  initialData,
  products,
  readOnly,
  qrDataUrl,
}: {
  initialData: StorefrontData
  products?: AgentPricingRow[]
  readOnly: boolean
  qrDataUrl: string | null
}) {
  const [data, setData] = useState(initialData)
  const [slug, setSlug] = useState(initialData.slug || "")
  const [storeName, setStoreName] = useState(initialData.storeName || "")
  const [tagline, setTagline] = useState(initialData.tagline || "")
  const [logoUrl, setLogoUrl] = useState(initialData.logoUrl || "")
  const [bannerUrl, setBannerUrl] = useState(initialData.bannerUrl || "")
  const [whatsappNumber, setWhatsappNumber] = useState(initialData.whatsappNumber || "")
  const [announcement, setAnnouncement] = useState(initialData.announcement || "")

  // Active WYSIWYG editing fields
  const [editingField, setEditingField] = useState<string | null>(null)
  const [showQrModal, setShowQrModal] = useState(false)
  const [showMobilePreview, setShowMobilePreview] = useState(false)

  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const logoFileInputRef = useRef<HTMLInputElement>(null)
  const bannerFileInputRef = useRef<HTMLInputElement>(null)

  const sfConfig = getStorefrontConfig(data.subdomainUrl)
  const activeSlug = slug.trim() || data.slug || data.webSalesId
  const salesUrl = sfConfig.formatSubdomainUrl(activeSlug)

  // Derive unsaved changes state
  const hasUnsavedChanges =
    slug !== (data.slug || "") ||
    storeName !== (data.storeName || "") ||
    tagline !== (data.tagline || "") ||
    logoUrl !== (data.logoUrl || "") ||
    bannerUrl !== (data.bannerUrl || "") ||
    whatsappNumber !== (data.whatsappNumber || "") ||
    announcement !== (data.announcement || "")

  // Prompt on page exit or navigation
  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = "You have unsaved changes. Are you sure you want to leave?"
      return e.returnValue
    }

    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a")
      if (!target) return

      const href = target.getAttribute("href")
      if (!href) return

      const isTargetBlank = target.getAttribute("target") === "_blank"
      const isDownload = target.hasAttribute("download")
      const isExternal = href.startsWith("http") && !href.startsWith(window.location.origin)
      const isHash = href.startsWith("#")

      if (isTargetBlank || isDownload || isExternal || isHash) return

      const ok = window.confirm("You have unsaved changes. Are you sure you want to leave?")
      if (!ok) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("click", handleAnchorClick, true)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("click", handleAnchorClick, true)
    }
  }, [hasUnsavedChanges])

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") {
        setLogoUrl(event.target.result)
        setEditingField(null)
      }
    }
    reader.readAsDataURL(file)
  }

  function handleBannerFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") {
        setBannerUrl(event.target.result)
        setEditingField(null)
      }
    }
    reader.readAsDataURL(file)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(salesUrl)
      setMessage("Store link copied!")
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage("Copy failed. Please copy manually.")
    }
  }

  function shareOnWhatsApp() {
    const text = `Hello! You can buy WAEC and BECE result checkers from my shop here: ${salesUrl}`
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  function downloadQr() {
    if (!qrDataUrl) return
    const link = document.createElement("a")
    link.href = qrDataUrl
    link.download = "dashchecker-store-qr.png"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setMessage("QR code downloaded.")
    setTimeout(() => setMessage(null), 3000)
  }

  async function handleSave() {
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
          announcement: announcement.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        const msg = Array.isArray(result.message)
          ? result.message.join(". ")
          : result.message || "Failed to update storefront settings."
        throw new Error(msg)
      }

      const updated = (await response.json()) as StorefrontData
      setData(updated)
      setSuccess("Store changes published live!")
      setEditingField(null)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.")
    } finally {
      setSaving(false)
    }
  }

  function handleDiscard() {
    setSlug(data.slug || "")
    setStoreName(data.storeName || "")
    setTagline(data.tagline || "")
    setLogoUrl(data.logoUrl || "")
    setBannerUrl(data.bannerUrl || "")
    setWhatsappNumber(data.whatsappNumber || "")
    setAnnouncement(data.announcement || "")
    setEditingField(null)
    setError(null)
  }

  const liveStoreName = storeName.trim() || data.storeName || data.webSalesId
  const liveTagline = tagline.trim() || data.tagline || "Click here to add a store slogan"
  const liveLogo = logoUrl || data.logoUrl
  const liveBanner = bannerUrl || data.bannerUrl
  const liveAnnouncement = announcement.trim() || "Click to add an announcement banner (e.g. 📢 2026 WASSCE Checkers In Stock!)"
  const liveWhatsapp = whatsappNumber.trim()

  return (
    <div className="space-y-6 pb-24">
      {/* Feedback Messages */}
      {error ? (
        <p className="text-xs font-semibold text-destructive">{error}</p>
      ) : null}
      {success ? (
        <p className="text-xs font-semibold text-emerald-600">{success}</p>
      ) : null}

      {/* TOP SHARE & SUBDOMAIN TOOLBAR */}
      <Card className="border-border/75 bg-card p-4 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HugeiconsIcon icon={Link01Icon} className="size-4" />
            </span>

            {editingField === "slug" ? (
              <div className="flex items-center rounded-md border border-primary px-2 py-1 text-xs bg-background">
                <span className="text-muted-foreground select-none">{sfConfig.protocol}//</span>
                <input
                  autoFocus
                  disabled={readOnly}
                  value={slug}
                  onChange={(e) =>
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                  }
                  onBlur={() => setEditingField(null)}
                  placeholder={data.webSalesId}
                  className="bg-transparent font-mono font-bold text-primary outline-none w-36"
                />
                <span className="text-muted-foreground select-none">{sfConfig.suffix}</span>
              </div>
            ) : (
              <div
                onClick={() => !readOnly && setEditingField("slug")}
                className="group flex items-center gap-1.5 cursor-pointer rounded-lg px-2 py-1 hover:bg-muted/60"
                title="Click to edit subdomain slug"
              >
                <span className="font-mono text-sm font-bold text-primary underline-offset-4 group-hover:underline truncate max-w-[220px] sm:max-w-none">
                  {salesUrl}
                </span>
                <HugeiconsIcon icon={Edit02Icon} className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={copyLink} type="button" variant="outline" size="sm">
              <HugeiconsIcon data-icon="inline-start" icon={Copy01Icon} />
              Copy
            </Button>
            <Button
              disabled={readOnly}
              onClick={shareOnWhatsApp}
              type="button"
              size="sm"
              className="border-transparent bg-emerald-600 text-white hover:bg-emerald-700"
            >
              WhatsApp
            </Button>
            <Button
              onClick={() => setShowQrModal(true)}
              type="button"
              variant="outline"
              size="sm"
            >
              <HugeiconsIcon data-icon="inline-start" icon={QrCode01Icon} />
              QR Code
            </Button>
            <Button
              render={<a href={salesUrl} target="_blank" rel="noopener noreferrer" />}
              variant="secondary"
              size="sm"
              className="gap-1"
            >
              <span>Visit Store</span>
              <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3.5" />
            </Button>
          </div>
        </div>

        {message ? (
          <p className="mt-2 text-xs font-medium text-primary" role="status">
            {message}
          </p>
        ) : null}
      </Card>

      {/* MOBILE FORM-FIRST VIEW (< 768px / md:hidden) */}
      <div className="block md:hidden space-y-4">
        {/* Mobile Header / Quick Preview Action */}
        <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 p-3">
          <span className="text-xs font-medium text-muted-foreground">
            Form Editor Mode
          </span>
          <Button
            onClick={() => setShowMobilePreview(true)}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
          >
            <HugeiconsIcon icon={ViewIcon} className="size-3.5" />
            Preview Storefront
          </Button>
        </div>

        {/* Store Identity Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Storefront Details</CardTitle>
            <CardDescription className="text-xs">
              Basic branding and customer contact information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Store Name</Label>
              <Input
                disabled={readOnly}
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder={data.webSalesId}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Store Slogan / Tagline</Label>
              <Input
                disabled={readOnly}
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Official WAEC & BECE Checkers Hub"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">WhatsApp Support Number</Label>
              <Input
                disabled={readOnly}
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="e.g. 233241234567"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Announcement Ticker</Label>
              <Input
                disabled={readOnly}
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="e.g. 📢 2026 WASSCE checkers available now!"
              />
            </div>
          </CardContent>
        </Card>

        {/* Store Assets (Logo & Cover Banner) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Store Images</CardTitle>
            <CardDescription className="text-xs">
              Upload your logo avatar and header banner.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo Avatar Upload */}
            <div className="space-y-2">
              <Label className="text-xs">Store Logo</Label>
              <div className="flex items-center gap-3">
                <div className="size-14 rounded-xl border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {liveLogo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={liveLogo} alt="Logo" className="size-full object-cover" />
                  ) : (
                    <span className="font-heading font-bold text-lg text-muted-foreground">
                      {liveStoreName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <input
                    type="file"
                    ref={logoFileInputRef}
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoFileInputRef.current?.click()}
                    disabled={readOnly}
                    className="w-full text-xs"
                  >
                    <HugeiconsIcon data-icon="inline-start" icon={Upload01Icon} />
                    Upload Image
                  </Button>
                </div>
              </div>
            </div>

            {/* Cover Banner Upload */}
            <div className="space-y-2">
              <Label className="text-xs">Header Cover Banner</Label>
              <div className="flex flex-col gap-2">
                {liveBanner ? (
                  <div className="h-24 w-full rounded-xl border bg-muted overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={liveBanner} alt="Banner" className="size-full object-cover" />
                  </div>
                ) : null}
                <input
                  type="file"
                  ref={bannerFileInputRef}
                  accept="image/*"
                  onChange={handleBannerFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => bannerFileInputRef.current?.click()}
                  disabled={readOnly}
                  className="w-full text-xs"
                >
                  <HugeiconsIcon data-icon="inline-start" icon={ImageAdd01Icon} />
                  Upload Cover Image
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Storefront Products Summary */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Store Products</CardTitle>
              <CardDescription className="text-xs">Checkers offered on your store.</CardDescription>
            </div>
            <Button render={<Link href="/pricing" />} variant="ghost" size="sm" className="gap-1 text-xs text-primary h-7 px-2">
              <span>Manage Prices</span>
              <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {products && products.length > 0 ? (
              products.map((item) => {
                const hasPrice = typeof item.pricing.retailPriceMinor === "number" && item.pricing.retailPriceMinor > 0
                return (
                  <div key={item.product.id} className="flex items-center justify-between rounded-lg border p-2.5 text-xs">
                    <span className="font-semibold text-foreground">{item.product.name}</span>
                    {hasPrice ? (
                      <span className="font-bold text-primary">{money(item.pricing.retailPriceMinor!, item.pricing.currency)}</span>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-amber-600">Price Not Set</Badge>
                    )}
                  </div>
                )
              })
            ) : (
              <p className="text-xs text-muted-foreground">No products configured.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DESKTOP INTERACTIVE CANVAS VIEW (≥ 768px / md:block) */}
      <div className="hidden md:block">
        <StoreCanvasPreview
          liveAnnouncement={liveAnnouncement}
          liveBanner={liveBanner}
          liveLogo={liveLogo}
          liveStoreName={liveStoreName}
          liveTagline={liveTagline}
          liveWhatsapp={liveWhatsapp}
          editingField={editingField}
          setEditingField={setEditingField}
          readOnly={readOnly}
          announcement={announcement}
          setAnnouncement={setAnnouncement}
          bannerUrl={bannerUrl}
          setBannerUrl={setBannerUrl}
          storeName={storeName}
          setStoreName={setStoreName}
          tagline={tagline}
          setTagline={setTagline}
          whatsappNumber={whatsappNumber}
          setWhatsappNumber={setWhatsappNumber}
          bannerFileInputRef={bannerFileInputRef}
          logoFileInputRef={logoFileInputRef}
          handleBannerFileChange={handleBannerFileChange}
          handleLogoFileChange={handleLogoFileChange}
          products={products}
        />
      </div>

      {/* MOBILE PREVIEW MODAL */}
      <Dialog open={showMobilePreview} onOpenChange={setShowMobilePreview}>
        <DialogPopup className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-center text-sm font-semibold">
              Live Storefront Preview
            </DialogTitle>
          </DialogHeader>
          <StoreCanvasPreview
            liveAnnouncement={liveAnnouncement}
            liveBanner={liveBanner}
            liveLogo={liveLogo}
            liveStoreName={liveStoreName}
            liveTagline={liveTagline}
            liveWhatsapp={liveWhatsapp}
            editingField={editingField}
            setEditingField={setEditingField}
            readOnly={readOnly}
            announcement={announcement}
            setAnnouncement={setAnnouncement}
            bannerUrl={bannerUrl}
            setBannerUrl={setBannerUrl}
            storeName={storeName}
            setStoreName={setStoreName}
            tagline={tagline}
            setTagline={setTagline}
            whatsappNumber={whatsappNumber}
            setWhatsappNumber={setWhatsappNumber}
            bannerFileInputRef={bannerFileInputRef}
            logoFileInputRef={logoFileInputRef}
            handleBannerFileChange={handleBannerFileChange}
            handleLogoFileChange={handleLogoFileChange}
            products={products}
          />
        </DialogPopup>
      </Dialog>

      {/* FLOATING ACTION BAR (Appears when changes exist or on mobile) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-border/80 bg-zinc-950 px-4 py-2.5 text-white shadow-2xl backdrop-blur-md max-w-[95vw]">
        <Button
          onClick={() => setShowMobilePreview(true)}
          type="button"
          variant="outline"
          size="sm"
          className="md:hidden gap-1 text-xs h-8 bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800 hover:text-white"
        >
          <HugeiconsIcon icon={ViewIcon} className="size-3.5" />
          Preview
        </Button>

        {hasUnsavedChanges ? (
          <>
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium">
              <span className="size-2 rounded-full bg-amber-400 animate-ping" />
              <span>Unsaved changes</span>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDiscard}
              disabled={saving}
              className="text-zinc-400 hover:text-white h-8 text-xs"
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-600 font-semibold text-white hover:bg-emerald-500 h-8 text-xs px-3.5"
            >
              {saving ? "Publishing..." : "Publish Live Changes"}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 font-semibold text-white hover:bg-emerald-500 h-8 text-xs px-3.5"
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        )}
      </div>

      {/* QR CODE MODAL */}
      {showQrModal && qrDataUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border bg-background p-6 shadow-xl space-y-4 text-center">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-heading text-lg font-bold text-foreground">Store QR Code</h3>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-5" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 py-2">
              <div className="rounded-xl border bg-white p-3 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Store QR Code" className="size-48 rounded-md" />
              </div>
              <p className="font-mono text-xs font-semibold text-primary">{salesUrl}</p>
              <p className="text-xs text-muted-foreground">
                Buyers can scan this QR code with any smartphone camera to open your store instantly.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowQrModal(false)}
              >
                Close
              </Button>
              <Button onClick={downloadQr} size="sm">
                <HugeiconsIcon data-icon="inline-start" icon={Download04Icon} />
                Download PNG
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function StoreCanvasPreview({
  liveAnnouncement,
  liveBanner,
  liveLogo,
  liveStoreName,
  liveTagline,
  liveWhatsapp,
  editingField,
  setEditingField,
  readOnly,
  announcement,
  setAnnouncement,
  bannerUrl,
  setBannerUrl,
  storeName,
  setStoreName,
  tagline,
  setTagline,
  whatsappNumber,
  setWhatsappNumber,
  bannerFileInputRef,
  logoFileInputRef,
  handleBannerFileChange,
  handleLogoFileChange,
  products,
}: {
  liveAnnouncement: string
  liveBanner: string | null
  liveLogo: string | null
  liveStoreName: string
  liveTagline: string
  liveWhatsapp: string
  editingField: string | null
  setEditingField: (field: string | null) => void
  readOnly: boolean
  announcement: string
  setAnnouncement: (val: string) => void
  bannerUrl: string
  setBannerUrl: (val: string) => void
  storeName: string
  setStoreName: (val: string) => void
  tagline: string
  setTagline: (val: string) => void
  whatsappNumber: string
  setWhatsappNumber: (val: string) => void
  bannerFileInputRef: React.RefObject<HTMLInputElement | null>
  logoFileInputRef: React.RefObject<HTMLInputElement | null>
  handleBannerFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleLogoFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  products?: AgentPricingRow[]
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border/80 bg-background shadow-xl">
      {/* Helper Banner */}
      <div className="flex items-center justify-between border-b bg-muted/40 px-5 py-2 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          Interactive Storefront — Click any item below to edit live
        </span>
      </div>

      {/* Announcement Ticker Bar */}
      <div className="group relative bg-primary px-4 py-2.5 text-center text-xs font-semibold text-primary-foreground">
        {editingField === "announcement" ? (
          <div className="mx-auto flex max-w-xl items-center gap-2">
            <Input
              autoFocus
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder="e.g. 📢 2026 WASSCE checkers available now!"
              className="h-8 bg-primary-foreground text-foreground text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setEditingField(null)}
              className="h-8 px-2 text-xs"
            >
              Done
            </Button>
          </div>
        ) : (
          <div
            onClick={() => !readOnly && setEditingField("announcement")}
            className="flex items-center justify-center gap-2 cursor-pointer transition-opacity hover:opacity-90"
          >
            <HugeiconsIcon icon={Megaphone01Icon} className="size-4 shrink-0" />
            <span className="truncate">{liveAnnouncement}</span>
            <HugeiconsIcon icon={Edit02Icon} className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </div>

      {/* Hero Cover Banner */}
      <div className="group relative h-40 w-full bg-gradient-to-r from-primary/20 via-primary/10 to-muted sm:h-56">
        {liveBanner ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={liveBanner}
            alt="Store Cover Banner"
            className="h-full w-full object-cover"
          />
        ) : null}

        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 p-4">
          <input
            type="file"
            ref={bannerFileInputRef}
            accept="image/*"
            onChange={handleBannerFileChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => bannerFileInputRef.current?.click()}
            disabled={readOnly}
            className="shadow-lg"
          >
            <HugeiconsIcon data-icon="inline-start" icon={ImageAdd01Icon} />
            Upload Cover
          </Button>
        </div>
      </div>

      {/* Store Profile Identity Row */}
      <div className="relative px-5 pb-5 pt-0 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-5">
            {/* Overlapping Logo Avatar */}
            <div className="group/avatar relative -mt-14 size-24 shrink-0 rounded-2xl border-4 border-background bg-card shadow-lg overflow-hidden sm:-mt-16 sm:size-28">
              {liveLogo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={liveLogo}
                  alt={liveStoreName}
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center rounded-xl bg-primary/10 font-heading text-3xl font-bold text-primary">
                  {liveStoreName.charAt(0).toUpperCase()}
                </span>
              )}

              <input
                type="file"
                ref={logoFileInputRef}
                accept="image/*"
                onChange={handleLogoFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => logoFileInputRef.current?.click()}
                disabled={readOnly}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-semibold gap-0.5"
              >
                <HugeiconsIcon icon={Upload01Icon} className="size-4" />
                <span>Logo</span>
              </button>
            </div>

            {/* Store Name & Slogan */}
            <div className="space-y-1">
              {editingField === "storeName" ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Enter Store Name"
                    className="h-9 text-base font-bold font-heading"
                  />
                  <Button size="sm" onClick={() => setEditingField(null)}>Done</Button>
                </div>
              ) : (
                <div
                  onClick={() => !readOnly && setEditingField("storeName")}
                  className="group/title inline-flex items-center gap-2 cursor-pointer rounded-lg p-1 hover:bg-muted/60"
                >
                  <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {liveStoreName}
                  </h1>
                  <HugeiconsIcon icon={StoreVerifiedIcon} className="size-4 text-primary" />
                </div>
              )}

              {editingField === "tagline" ? (
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    autoFocus
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Enter Slogan"
                    className="h-8 text-xs"
                  />
                  <Button size="sm" onClick={() => setEditingField(null)}>Done</Button>
                </div>
              ) : (
                <div
                  onClick={() => !readOnly && setEditingField("tagline")}
                  className="group/tagline flex items-center gap-1.5 cursor-pointer rounded-lg p-1 hover:bg-muted/60"
                >
                  <p className="text-xs text-muted-foreground">{liveTagline}</p>
                </div>
              )}
            </div>
          </div>

          {/* WhatsApp Contact */}
          <div className="pt-2 sm:pt-0">
            <button
              type="button"
              onClick={() => !readOnly && setEditingField("whatsapp")}
              className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs"
            >
              <HugeiconsIcon icon={Comment01Icon} className="size-3.5" />
              <span>{liveWhatsapp ? `WhatsApp: ${liveWhatsapp}` : "Add WhatsApp"}</span>
            </button>
          </div>
        </div>

        {/* Storefront Products */}
        <div className="mt-6 space-y-3 rounded-xl border bg-muted/20 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Available Products
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {products && products.length > 0 ? (
              products.map((item) => {
                const hasPrice = typeof item.pricing.retailPriceMinor === "number" && item.pricing.retailPriceMinor > 0

                return (
                  <div
                    key={item.product.id}
                    className="rounded-lg border bg-background p-3 shadow-xs flex flex-col justify-between gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-foreground">{item.product.name}</p>
                      {item.product.scopeDisclosure ? (
                        <p className="text-[11px] text-muted-foreground">{item.product.scopeDisclosure}</p>
                      ) : null}
                    </div>
                    {hasPrice ? (
                      <p className="font-heading text-sm font-bold text-primary">
                        {money(item.pricing.retailPriceMinor!, item.pricing.currency)}
                      </p>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-amber-600">Price Not Set</Badge>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="rounded-lg border bg-background p-3 shadow-xs space-y-1">
                <p className="text-xs font-bold text-foreground">WASSCE Result Checker</p>
                <p className="font-heading text-sm font-bold text-primary">GHS 25.00</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
