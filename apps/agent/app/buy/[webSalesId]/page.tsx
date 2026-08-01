import { notFound } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  SecurityCheckIcon,
  ShoppingBag01Icon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@workspace/ui/components/badge"
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { DorafMark } from "@/components/doraf-mark"
import {
  StorefrontCheckout,
  type StorefrontProduct,
} from "@/components/storefront-checkout"
import { ApiError, apiJson, apiRequest } from "@/lib/agent-api"

interface Storefront {
  agent: { displayName: string }
  products: StorefrontProduct[]
}

export default async function StorefrontPage(
  props: PageProps<"/buy/[webSalesId]">
) {
  const { webSalesId } = await props.params
  let storefront: Storefront
  try {
    const response = await apiRequest(
      `/sales-channels/web/${encodeURIComponent(webSalesId)}`
    )
    storefront = (await apiJson(response)) as Storefront
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  return (
    <main className="min-h-svh bg-muted/35">
      <header className="border-b bg-background/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <DorafMark />
          <Badge variant="secondary">
            <HugeiconsIcon icon={SecurityCheckIcon} />
            Secure checkout
          </Badge>
        </div>
      </header>
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
        <section className="flex flex-col gap-3 text-center sm:items-center">
          <Badge className="w-fit" variant="outline">
            Doraf agent store
          </Badge>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            WAEC result checkers, delivered securely.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-pretty text-muted-foreground">
            You&apos;re buying through {storefront.agent.displayName}. Choose
            the checker that matches your examination.
          </p>
        </section>

        {storefront.products.length === 0 ? (
          <Empty className="min-h-56 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={ShoppingBag01Icon} strokeWidth={1.7} />
              </EmptyMedia>
              <EmptyTitle>No checkers available right now</EmptyTitle>
              <EmptyDescription>
                This store is active, but its checker products are currently
                unavailable. Please check again later.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <section className="grid gap-5 md:grid-cols-3">
              {storefront.products.map((product) => (
                <Card key={product.id}>
                  <CardHeader>
                    <CardTitle>{product.name}</CardTitle>
                    <CardDescription className="leading-6">
                      {product.scopeDisclosure}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <p className="font-heading text-2xl font-semibold">
                      {money(product.retailPriceMinor, product.currency)}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" render={<a href="#checkout" />}>
                      Begin checkout
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </section>
            <StorefrontCheckout
              products={storefront.products}
              webSalesId={webSalesId}
            />
          </>
        )}
      </div>
    </main>
  )
}

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
  }).format(minor / 100)
}
