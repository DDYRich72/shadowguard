import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/authz";

export default async function AgentGuardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ctx = await getSessionContext();
  if (!ctx) {
    redirect("/login?next=/dashboard/agent-guard");
  }
  return children;
}
