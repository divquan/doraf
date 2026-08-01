import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { agentSessionCookie } from "@/lib/agent-session"

export default async function Page() {
  redirect((await cookies()).has(agentSessionCookie) ? "/dashboard" : "/login")
}
