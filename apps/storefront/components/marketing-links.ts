export function getAgentPortalUrl(path = "/register") {
  const baseUrl =
    process.env.NEXT_PUBLIC_DASHCHECKER_AGENT_WEB_URL || "http://localhost:3002"

  return `${baseUrl.replace(/\/$/, "")}${path}`
}
