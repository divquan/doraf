"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  ManualInventoryForm,
  type ProductOption,
} from "./manual-inventory-form"

export function InventoryImportDialog({
  products,
}: {
  products: ProductOption[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button onClick={() => setOpen(true)} type="button">
        Add voucher inventory
      </Button>
      <DialogPopup className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="mb-4">
          <DialogTitle>Add voucher inventory</DialogTitle>
          <DialogDescription className="leading-6">
            Enter serial-number and PIN pairs directly. Dashchecker validates every
            entry before encrypting and committing the complete batch.
          </DialogDescription>
        </DialogHeader>
        <ManualInventoryForm
          onImported={() => setOpen(false)}
          products={products}
        />
      </DialogPopup>
    </Dialog>
  )
}
