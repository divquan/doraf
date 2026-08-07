export type AdminViewerRole = "ADMINISTRATOR" | "SUPPORT"

export interface ProductPricingPolicy {
  basePriceMinor: number
  maximumRetailPriceMinor: number
}

export interface PricingProduct {
  id: string
  code: string
  name: string
  status: "ACTIVE" | "UNAVAILABLE"
  policy: null | ProductPricingPolicy
}

export interface AgentPricingSummary {
  id: string
  name: string
  phoneMask: string
  status: "ACTIVE" | "SUSPENDED"
  webSalesId: string | null
  overrideCount: number
}

export interface AdminPricingData {
  viewerRole: AdminViewerRole
  products: PricingProduct[]
  agents: AgentPricingSummary[]
}

export interface AgentPricingOverride {
  id: string
  productId: string
  productCode: string
  productName: string
  basePriceMinor: number | null
  maximumRetailPriceMinor: number | null
  effectiveFrom: string
  effectiveTo: string | null
  reason: string
  createdAt: string
}

export interface AgentPricingOverridesData {
  overrides: AgentPricingOverride[]
  products: PricingProduct[]
}
