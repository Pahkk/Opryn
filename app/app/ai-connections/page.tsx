import { redirect } from "next/navigation";

export default async function AIConnectionsPage() {
  redirect("/app/integrations?filter=ai");
}
