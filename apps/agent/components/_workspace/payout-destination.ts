export interface PayoutDestinationData {
  id?: string
  network: string
  accountName: string
  phoneMask: string
  createdAt?: string
}

export function isPayoutDestination(
  value: PayoutDestinationData | null | undefined
): value is PayoutDestinationData {
  return Boolean(value && value.network && value.phoneMask)
}
