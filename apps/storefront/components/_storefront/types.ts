// Shared storefront checkout types.

declare global {
  interface Window {
    PaystackPop?: new () => {
      resumeTransaction(
        accessCode: string,
        callbacks?: PaystackTransactionCallbacks
      ): void
    }
  }
}

export interface PaystackTransaction {
  id?: number | string
  reference?: string
  message?: string
  status?: string
}

export interface PaystackTransactionCallbacks {
  onSuccess?: (transaction: PaystackTransaction) => void
  onCancel?: () => void
  onError?: (error: { message?: string }) => void
  onLoad?: (transaction: PaystackTransaction) => void
}

export interface StorefrontProduct {
  id: string
  code: string
  name: string
  scopeDisclosure: string
  retailPriceMinor: number
  currency: string
}

export interface CreatedOrder {
  orderReference: string
  productName: string
  quantity: number
  currency: string
  totalMinor: number
  deliveryPhoneMask: string
  deliveryEmailMask: string | null
  priceExpiresAt: string
  checkoutAccessToken: string
  checkoutAccessExpiresAt: string
  payment: PaymentStatus
}

export interface PaymentStatus {
  reference: string
  state: string
  providerStatus: string | null
  displayText: string | null
  authorizationExpiresAt: string
  accessCode?: string
}

export interface CheckoutVoucher {
  position: number
  serialNumber: string
  pin: string
}

export interface CheckoutReveal {
  orderReference: string
  product: {
    code: string
    name: string
  }
  vouchers: CheckoutVoucher[]
  usageReminder: string
}

export interface OrderStatus {
  orderReference: string
  paymentState: string
  fulfillmentState: string
  payment: PaymentStatus | null
  delivery: {
    total: number
    pending: number
    delivered: number
    channels: string[]
  }
}
