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
  SecurityCheckIcon,
  StoreVerifiedIcon,
  Upload01Icon,
} from "@hugeicons/core-free-icons"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const logoFileInputRef = useRef<HTMLInputElement>(null)
  const bannerFileInputRef = useRef<HTMLInputElement>(null)

  const sfConfig = getStorefrontConfig(data.subdomainUrl)
  const activeSlug = slug.trim() || data.slug || data.webSalesId
  const salesUrl = sfConfig.formatSubdomainUrl(activeSlug)

  // Track unsaved changes
  useEffect(() => {
    const isDifferent =
      slug !== (data.slug || "") ||
      storeName !== (data.storeName || "") ||
      tagline !== (data.tagline || "") ||
      logoUrl !== (data.logoUrl || "") ||
      bannerUrl !== (data.bannerUrl || "") ||
      whatsappNumber !== (data.whatsappNumber || "") ||
      announcement !== (data.announcement || "")
    setHasUnsavedChanges(isDifferent)
  }, [slug, storeName, tagline, logoUrl, bannerUrl, whatsappNumber, announcement, data])

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
    link.download = "doraf-store-qr.png"
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
    <div className="space-y-6 pb-20">
      {/* 1. TOP SHARE & SUBDOMAIN TOOLBAR */}
      <Card className="border-border/75 bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Editable Subdomain Address */}
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
                <span className="font-mono text-sm font-bold text-primary underline-offset-4 group-hover:underline">
                  {salesUrl}
                </span>
                <HugeiconsIcon icon={Edit02Icon} className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

          {/* Share Action Pills */}
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
            >
              Visit Store ↗
            </Button>
          </div>
        </div>

        {message ? (
          <p className="mt-2 text-xs font-medium text-primary" role="status">
            {message}
          </p>
        ) : null}
      </Card>

      {/* 2. THE STORE CANVAS (THE PAGE IS YOUR STORE!) */}
      <div className="overflow-hidden rounded-3xl border border-border/80 bg-background shadow-xl">
        {/* Helper Banner */}
        <div className="flex items-center justify-between border-b bg-muted/40 px-5 py-2 text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Interactive Storefront — Click any item below to edit it live on screen
          </span>
        </div>

        {/* Announcement Ticker Bar (Click to Edit) */}
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

        {/* Hero Cover Banner (Hover to Upload / Edit) */}
        <div className="group relative h-48 w-full bg-gradient-to-r from-primary/20 via-primary/10 to-muted sm:h-64">
          {liveBanner ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={liveBanner}
              alt="Store Cover Banner"
              className="h-full w-full object-cover"
            />
          ) : null}

          {/* Hover Overlay Button to Change Banner */}
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
              Upload Cover Banner
            </Button>
            {editingField === "bannerUrl" ? (
              <div className="flex items-center gap-2 bg-background p-2 rounded-xl shadow-xl">
                <Input
                  autoFocus
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="Or paste banner image URL"
                  className="h-8 text-xs w-60"
                />
                <Button size="sm" onClick={() => setEditingField(null)}>Done</Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingField("bannerUrl")}
                className="bg-background/80 backdrop-blur-md"
              >
                Paste URL
              </Button>
            )}
          </div>
        </div>

        {/* Store Profile Identity Row */}
        <div className="relative px-6 pb-6 pt-0 sm:px-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
              {/* Overlapping Logo Avatar (Hover to Upload) */}
              <div className="group/avatar relative -mt-16 size-28 shrink-0 rounded-3xl border-4 border-background bg-card shadow-xl overflow-hidden sm:-mt-20 sm:size-32">
                {liveLogo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={liveLogo}
                    alt={liveStoreName}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center rounded-2xl bg-primary/10 font-heading text-4xl font-bold text-primary">
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
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-semibold gap-1"
                >
                  <HugeiconsIcon icon={Upload01Icon} className="size-5" />
                  <span>Change Logo</span>
                </button>
              </div>

              {/* Click-to-Edit Store Name & Slogan */}
              <div className="space-y-1">
                {/* Store Name Edit */}
                {editingField === "storeName" ? (
                  <div className="flex items-center gap-2">
                    <Input
                      autoFocus
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Enter Store Name"
                      className="h-10 text-lg font-bold font-heading"
                    />
                    <Button size="sm" onClick={() => setEditingField(null)}>Done</Button>
                  </div>
                ) : (
                  <div
                    onClick={() => !readOnly && setEditingField("storeName")}
                    className="group/title inline-flex items-center gap-2 cursor-pointer rounded-lg p-1 hover:bg-muted/60"
                    title="Click to edit Store Name"
                  >
                    <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                      {liveStoreName}
                    </h1>
                    <HugeiconsIcon icon={StoreVerifiedIcon} className="size-5 text-primary" />
                    <HugeiconsIcon icon={Edit02Icon} className="size-4 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity" />
                  </div>
                )}

                {/* Tagline Slogan Edit */}
                {editingField === "tagline" ? (
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      autoFocus
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="Enter Store Slogan / Tagline"
                      className="h-8 text-xs"
                    />
                    <Button size="sm" onClick={() => setEditingField(null)}>Done</Button>
                  </div>
                ) : (
                  <div
                    onClick={() => !readOnly && setEditingField("tagline")}
                    className="group/tagline flex items-center gap-1.5 cursor-pointer rounded-lg p-1 hover:bg-muted/60"
                    title="Click to edit Slogan"
                  >
                    <p className="text-sm text-muted-foreground">
                      {liveTagline}
                    </p>
                    <HugeiconsIcon icon={Edit02Icon} className="size-3.5 text-muted-foreground opacity-0 group-hover/tagline:opacity-100 transition-opacity" />
                  </div>
                )}
              </div>
            </div>

            {/* WhatsApp Contact Help Button (Click to Edit) */}
            <div className="pt-2 sm:pt-0">
              {editingField === "whatsapp" ? (
                <div className="flex items-center gap-2 bg-background p-2 rounded-xl border shadow-md">
                  <Input
                    autoFocus
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="WhatsApp e.g. 233241234567"
                    className="h-8 text-xs w-44"
                  />
                  <Button size="sm" onClick={() => setEditingField(null)}>Done</Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => !readOnly && setEditingField("whatsapp")}
                  className="group/wa flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition-transform hover:scale-105"
                  title="Click to edit WhatsApp support number"
                >
                  <HugeiconsIcon icon={Comment01Icon} className="size-4" />
                  <span>
                    {liveWhatsapp ? `WhatsApp: ${liveWhatsapp}` : "Add WhatsApp Support"}
                  </span>
                  <HugeiconsIcon icon={Edit02Icon} className="size-3.5 opacity-0 group-hover/wa:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
          </div>

          {/* Available Storefront Products (Buyer View) */}
          <div className="mt-8 space-y-3 rounded-2xl border bg-muted/20 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Your Storefront Products
              </p>
              <Button
                render={<Link href="/pricing" />}
                variant="ghost"
                size="sm"
                nativeButton={false}
                className="text-xs text-primary hover:underline h-7 px-2"
              >
                Manage Prices ↗
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {products && products.length > 0 ? (
                products.map((item) => {
                  const hasPrice =
                    typeof item.pricing.retailPriceMinor === "number" &&
                    item.pricing.retailPriceMinor > 0

                  return (
                    <div
                      key={item.product.id}
                      className="rounded-xl border bg-background p-4 shadow-xs flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-foreground">
                            {item.product.name}
                          </p>
                          <Badge
                            variant={hasPrice ? "secondary" : "outline"}
                            className={cn(
                              "text-[10px]",
                              !hasPrice &&
                                "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-semibold"
                            )}
                          >
                            {hasPrice ? "Active" : "Price Not Set"}
                          </Badge>
                        </div>
                        {item.product.scopeDisclosure ? (
                          <p className="text-xs text-muted-foreground">
                            {item.product.scopeDisclosure}
                          </p>
                        ) : null}
                      </div>

                      {hasPrice ? (
                        <p className="font-heading text-base font-bold text-primary pt-1">
                          {money(
                            item.pricing.retailPriceMinor!,
                            item.pricing.currency
                          )}
                        </p>
                      ) : (
                        <div className="pt-1">
                          <Button
                            render={<Link href="/pricing" />}
                            variant="outline"
                            size="sm"
                            nativeButton={false}
                            className="w-full text-xs font-semibold border-amber-500/50 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
                          >
                            Price Not Set — Set Price ↗
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <>
                  <div className="rounded-xl border bg-background p-4 shadow-xs space-y-1">
                    <p className="text-sm font-bold text-foreground">WASSCE Result Checker</p>
                    <p className="text-xs text-muted-foreground">School & Private Candidates</p>
                    <p className="font-heading text-base font-bold text-primary pt-1">GHS 25.00</p>
                  </div>
                  <div className="rounded-xl border bg-background p-4 shadow-xs flex flex-col justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-foreground">BECE Result Checker</p>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-semibold"
                        >
                          Price Not Set
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">BECE Candidates</p>
                    </div>
                    <div className="pt-1">
                      <Button
                        render={<Link href="/pricing" />}
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        className="w-full text-xs font-semibold border-amber-500/50 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
                      >
                        Price Not Set — Set Price ↗
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. FLOATING SAVE / DISCARD BAR (Appears when changes exist) */}
      {hasUnsavedChanges ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-2xl border border-border/80 bg-zinc-950 px-6 py-3 text-white shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="size-2 rounded-full bg-amber-400 animate-ping" />
            <span>You have unsaved changes</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDiscard}
              disabled={saving}
              className="text-zinc-400 hover:text-white"
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
            >
              {saving ? "Publishing..." : "Publish Live Changes"}
            </Button>
          </div>
        </div>
      ) : null}

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
