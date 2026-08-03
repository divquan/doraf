import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"

interface AgentSummary {
  name: string
  phoneMask: string
  status: "ACTIVE" | "SUSPENDED"
}

interface AccountSummaryCardProps {
  agent: AgentSummary
}

export function AccountSummaryCard({ agent }: AccountSummaryCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Security & Account</CardTitle>
        <CardDescription>
          Your current account access details and registration status.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">Registered Name</span>
          <span className="text-sm font-medium">{agent.name}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">Sign-in method</span>
          <span className="text-sm font-medium">SMS one-time code</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">Phone</span>
          <span className="text-sm font-medium">{agent.phoneMask}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">Account status</span>
          <Badge
            variant={agent.status === "ACTIVE" ? "secondary" : "destructive"}
          >
            {agent.status === "ACTIVE" ? "Active" : "Suspended"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
