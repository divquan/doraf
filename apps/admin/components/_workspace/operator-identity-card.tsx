import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { AdminRole } from "@/components/_workspace/workspace-sidebar"

interface OperatorIdentityCardProps {
  displayName: string
  role: AdminRole
}

export function OperatorIdentityCard({
  displayName,
  role,
}: OperatorIdentityCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operator identity</CardTitle>
        <CardDescription className="leading-6">
          Details for the currently signed-in operator.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-5 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted-foreground">Display name</dt>
            <dd className="mt-1 font-medium">{displayName}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Role</dt>
            <dd className="mt-1">
              <Badge
                variant={role === "ADMINISTRATOR" ? "default" : "secondary"}
              >
                {role === "ADMINISTRATOR" ? "Administrator" : "Support"}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Sign-in method</dt>
            <dd className="mt-1 font-medium">Passkey</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
