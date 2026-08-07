"use client"

import { FormEvent, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select"
import { Spinner } from "@workspace/ui/components/spinner"
import { type PayoutDestinationData } from "./payout-destination"

export type { PayoutDestinationData } from "./payout-destination"

export function PayoutDestinationForm({
  currentDestination,
  onSaved,
  onCancel,
}: {
  currentDestination: PayoutDestinationData | null
  onSaved: (destination: PayoutDestinationData) => void
  onCancel?: () => void
}) {
  const [network, setNetwork] = useState(currentDestination?.network ?? "MTN")
  const [accountNumber, setAccountNumber] = useState("")
  const [validatedData, setValidatedData] = useState<{
    accountName: string
    accountNumberMask: string
  } | null>(null)
  
  const [validating, setValidating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleValidate(event: FormEvent) {
    event.preventDefault()
    if (!accountNumber.trim()) return

    setValidating(true)
    setError(null)
    setValidatedData(null)

    try {
      const response = await fetch("/api/payouts/destination/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network, accountNumber: accountNumber.trim() }),
      })
      const data = (await response.json()) as {
        accountName: string
        accountNumberMask: string
        message?: string
      }
      if (!response.ok) {
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : "Could not validate Mobile Money account"
        )
      }
      setValidatedData({
        accountName: data.accountName,
        accountNumberMask: data.accountNumberMask,
      })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to validate account with Paystack"
      )
    } finally {
      setValidating(false)
    }
  }

  async function handleSave() {
    if (!validatedData) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch("/api/payouts/destination", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network, accountNumber: accountNumber.trim() }),
      })
      const data = (await response.json()) as {
        network: string
        accountName: string
        phoneMask: string
        message?: string
      }
      if (!response.ok) {
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : "Failed to save payout destination"
        )
      }
      onSaved({
        network: data.network,
        accountName: data.accountName,
        phoneMask: data.phoneMask,
      })
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to save destination"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Validation error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={handleValidate}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="momo-network">Mobile Money network</FieldLabel>
            <NativeSelect
              id="momo-network"
              name="network"
              onChange={(e) => {
                setNetwork(e.target.value)
                setValidatedData(null)
              }}
              value={network}
              disabled={validating || saving}
            >
              <NativeSelectOption value="MTN">
                MTN Mobile Money
              </NativeSelectOption>
              <NativeSelectOption value="TELECEL">
                Telecel Cash
              </NativeSelectOption>
              <NativeSelectOption value="AIRTELTIGO">
                AT Money
              </NativeSelectOption>
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="momo-number">
              Mobile Money phone number
            </FieldLabel>
            <Input
              id="momo-number"
              inputMode="tel"
              name="accountNumber"
              onChange={(e) => {
                setAccountNumber(e.target.value)
                setValidatedData(null)
              }}
              placeholder="0241234567"
              required
              type="tel"
              value={accountNumber}
              disabled={validating || saving}
            />
            <FieldDescription>
              Enter the Mobile Money registered phone number to receive payout transfers.
            </FieldDescription>
          </Field>
        </FieldGroup>

        {!validatedData ? (
          <div className="flex justify-end gap-2 mt-4 border-t pt-4">
            {onCancel ? (
              <Button onClick={onCancel} type="button" variant="outline">
                Cancel
              </Button>
            ) : null}
            <Button
              disabled={validating || !accountNumber.trim()}
              type="submit"
            >
              {validating ? <Spinner data-icon="inline-start" /> : null}
              {validating ? "Validating with Paystack…" : "Validate account"}
            </Button>
          </div>
        ) : null}
      </form>

      {validatedData ? (
        <div className="space-y-4 border-t pt-4">
          <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              className="size-5 text-emerald-600 dark:text-emerald-400"
            />
            <AlertTitle className="font-bold text-emerald-800 dark:text-emerald-300">
              Account name verified by Paystack
            </AlertTitle>
            <AlertDescription className="mt-1 space-y-1">
              <p>
                <span className="font-semibold">Account Name:</span>{" "}
                <span className="font-mono font-bold text-foreground">
                  {validatedData.accountName}
                </span>
              </p>
              <p>
                <span className="font-semibold">Network & Number:</span>{" "}
                {network} • {validatedData.accountNumberMask}
              </p>
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setValidatedData(null)}
              type="button"
              variant="outline"
              disabled={saving}
            >
              Re-enter number
            </Button>
            <Button onClick={handleSave} disabled={saving} type="button">
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {saving ? "Saving destination…" : "Confirm & save destination"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
