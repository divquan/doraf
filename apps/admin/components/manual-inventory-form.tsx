"use client"

import { FormEvent, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select"
import { Spinner } from "@workspace/ui/components/spinner"

interface ProductOption {
  id: string
  name: string
}

interface VoucherEntry {
  id: number
  serialNumber: string
  pin: string
}

interface InventoryError {
  rowNumber: number
  field: "csv" | "serial_number" | "pin"
  code: string
  message: string
}

interface InventoryPreview {
  valid: boolean
  sourceRowCount: number
  acceptedRowCount: number
  errors: InventoryError[]
}

export function ManualInventoryForm({
  products,
}: {
  products: ProductOption[]
}) {
  const router = useRouter()
  const nextEntryId = useRef(2)
  const [entries, setEntries] = useState<VoucherEntry[]>([
    { id: 1, serialNumber: "", pin: "" },
  ])
  const [preview, setPreview] = useState<InventoryPreview | null>(null)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function invalidatePreview() {
    setPreview(null)
    setMessage(null)
  }

  function updateEntry(
    id: number,
    field: "serialNumber" | "pin",
    value: string
  ) {
    invalidatePreview()
    setEntries((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    )
  }

  function addEntry() {
    invalidatePreview()
    const id = nextEntryId.current++
    setEntries((current) => [...current, { id, serialNumber: "", pin: "" }])
  }

  function removeEntry(id: number) {
    invalidatePreview()
    setEntries((current) => current.filter((entry) => entry.id !== id))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const unitCost = Number(form.get("unitAcquisitionCost"))
    const unitAcquisitionCostMinor = Math.round(unitCost * 100)
    if (!Number.isSafeInteger(unitAcquisitionCostMinor) || unitCost < 0) {
      setMessage("Enter a valid non-negative unit acquisition cost.")
      return
    }

    setPending(true)
    setMessage(null)
    const action = preview?.valid ? "commit" : "preview"
    const voucherEntries = entries.map(({ serialNumber, pin }) => ({
      serialNumber: serialNumber.trim(),
      pin: pin.trim(),
    }))
    const payload =
      action === "preview"
        ? {
            action,
            productId: String(form.get("productId")),
            entries: voucherEntries,
          }
        : {
            action,
            productId: String(form.get("productId")),
            vendorName: String(form.get("vendorName")),
            vendorReference: String(form.get("vendorReference")),
            acquisitionDate: String(form.get("acquisitionDate")),
            unitAcquisitionCostMinor: String(unitAcquisitionCostMinor),
            reason: String(form.get("reason")),
            entries: voucherEntries,
          }

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = (await response.json().catch(() => ({}))) as {
        message?: string
        errors?: InventoryError[]
        batchId?: string
        importedVoucherCount?: number
        valid?: boolean
        sourceRowCount?: number
        acceptedRowCount?: number
      }
      if (!response.ok) {
        if (result.errors?.length) {
          setPreview({
            valid: false,
            sourceRowCount: entries.length,
            acceptedRowCount: 0,
            errors: result.errors,
          })
        }
        throw new Error(result.message ?? "Inventory could not be saved")
      }
      if (action === "preview") {
        const nextPreview: InventoryPreview = {
          valid: Boolean(result.valid),
          sourceRowCount: Number(result.sourceRowCount ?? 0),
          acceptedRowCount: Number(result.acceptedRowCount ?? 0),
          errors: result.errors ?? [],
        }
        setPreview(nextPreview)
        setMessage(
          nextPreview.valid
            ? `${nextPreview.acceptedRowCount} voucher ${nextPreview.acceptedRowCount === 1 ? "entry is" : "entries are"} valid. Review the details, then confirm the import.`
            : "Correct the highlighted inventory entries and validate again."
        )
      } else {
        const importedCount = Number(result.importedVoucherCount ?? 0)
        setPreview(null)
        setEntries([{ id: nextEntryId.current++, serialNumber: "", pin: "" }])
        formElement.reset()
        setMessage(
          `${importedCount} voucher ${importedCount === 1 ? "was" : "were"} encrypted and added to available inventory.`
        )
        router.refresh()
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Inventory could not be saved"
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add voucher inventory</CardTitle>
        <CardDescription className="leading-6">
          Enter serial-number and PIN pairs directly. Doraf validates every
          entry before encrypting and committing the complete batch.
        </CardDescription>
      </CardHeader>
      <form onChange={invalidatePreview} onSubmit={submit}>
        <CardContent>
          <FieldGroup>
            <FieldSet>
              <FieldLegend>Source details</FieldLegend>
              <FieldDescription>
                These details identify the vendor batch in the audit history.
              </FieldDescription>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="inventory-product">Product</FieldLabel>
                  <NativeSelect
                    className="w-full"
                    id="inventory-product"
                    name="productId"
                    required
                  >
                    {products.map((product) => (
                      <NativeSelectOption key={product.id} value={product.id}>
                        {product.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <InventoryField
                  id="inventory-vendor"
                  label="Vendor"
                  name="vendorName"
                  placeholder="Authorized supplier"
                />
                <InventoryField
                  id="inventory-reference"
                  label="Invoice or reference"
                  name="vendorReference"
                  placeholder="INV-2026-001"
                />
                <InventoryField
                  id="inventory-date"
                  label="Acquisition date"
                  name="acquisitionDate"
                  type="date"
                />
                <InventoryField
                  id="inventory-cost"
                  label="Unit acquisition cost (GHS)"
                  min="0"
                  name="unitAcquisitionCost"
                  placeholder="10.00"
                  step="0.01"
                  type="number"
                />
                <InventoryField
                  id="inventory-reason"
                  label="Import reason"
                  minLength={5}
                  name="reason"
                  placeholder="Initial authorized stock load"
                />
              </FieldGroup>
            </FieldSet>

            <FieldSet>
              <FieldLegend>Voucher credentials</FieldLegend>
              <FieldDescription>
                PINs must contain exactly 12 digits. Values are encrypted and
                will not be shown again after import.
              </FieldDescription>
              <FieldGroup>
                {entries.map((entry, index) => {
                  const entryErrors = preview?.errors.filter(
                    (error) => error.rowNumber === index + 2
                  )
                  return (
                    <div
                      className="flex flex-col gap-3 rounded-lg border p-4"
                      key={entry.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">
                          Voucher {index + 1}
                        </p>
                        {entries.length > 1 ? (
                          <Button
                            onClick={() => removeEntry(entry.id)}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field
                          data-invalid={Boolean(
                            entryErrors?.some(
                              (error) => error.field === "serial_number"
                            )
                          )}
                        >
                          <FieldLabel htmlFor={`serial-${entry.id}`}>
                            Serial number
                          </FieldLabel>
                          <Input
                            aria-invalid={Boolean(
                              entryErrors?.some(
                                (error) => error.field === "serial_number"
                              )
                            )}
                            autoComplete="off"
                            id={`serial-${entry.id}`}
                            maxLength={64}
                            onChange={(event) =>
                              updateEntry(
                                entry.id,
                                "serialNumber",
                                event.target.value
                              )
                            }
                            required
                            value={entry.serialNumber}
                          />
                          {entryErrors
                            ?.filter((error) => error.field === "serial_number")
                            .map((error) => (
                              <FieldError key={error.code}>
                                {error.message}
                              </FieldError>
                            ))}
                        </Field>
                        <Field
                          data-invalid={Boolean(
                            entryErrors?.some((error) => error.field === "pin")
                          )}
                        >
                          <FieldLabel htmlFor={`pin-${entry.id}`}>
                            12-digit PIN
                          </FieldLabel>
                          <Input
                            aria-invalid={Boolean(
                              entryErrors?.some(
                                (error) => error.field === "pin"
                              )
                            )}
                            autoComplete="off"
                            id={`pin-${entry.id}`}
                            inputMode="numeric"
                            maxLength={12}
                            onChange={(event) =>
                              updateEntry(entry.id, "pin", event.target.value)
                            }
                            pattern="[0-9]{12}"
                            required
                            value={entry.pin}
                          />
                          {entryErrors
                            ?.filter((error) => error.field === "pin")
                            .map((error) => (
                              <FieldError key={error.code}>
                                {error.message}
                              </FieldError>
                            ))}
                        </Field>
                      </div>
                    </div>
                  )
                })}
              </FieldGroup>
              <Button onClick={addEntry} type="button" variant="outline">
                Add another voucher
              </Button>
            </FieldSet>

            {message ? (
              <Alert
                variant={preview && !preview.valid ? "destructive" : "default"}
              >
                <AlertTitle>
                  {preview?.valid
                    ? "Ready to import"
                    : preview
                      ? "Validation needs attention"
                      : "Inventory update"}
                </AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
        </CardContent>
        <CardFooter className="border-t pt-4">
          <Button disabled={pending || products.length === 0} type="submit">
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending
              ? preview?.valid
                ? "Importing…"
                : "Validating…"
              : preview?.valid
                ? `Confirm import of ${preview.acceptedRowCount}`
                : "Validate entries"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function InventoryField({
  id,
  label,
  ...props
}: React.ComponentProps<typeof Input> & { id: string; label: string }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} required {...props} />
    </Field>
  )
}
