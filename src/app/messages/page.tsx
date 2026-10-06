import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserConversations } from "@/lib/messaging/conversations";
import { MessagesClientPage } from "./MessagesClientPage";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  const conversations = await getUserConversations(currentUser.id);

  // Serialize Date objects for client component
  const serializedConversations = JSON.parse(JSON.stringify(conversations));

  return (
    <MessagesClientPage
      currentUser={currentUser}
      initialConversations={serializedConversations}
    />
  );
}
