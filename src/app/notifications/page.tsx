import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NotificationsClientPage } from "./NotificationsClientPage";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  const notifications = await prisma.notification.findMany({
    where: {
      recipientId: currentUser.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
    include: {
      actor: {
        select: {
          id: true,
          username: true,
          displayName: true,
          profilePhoto: true,
        },
      },
      post: {
        select: {
          id: true,
          imageUrl: true,
          caption: true,
        },
      },
    },
  });

  const serializedNotifications = JSON.parse(JSON.stringify(notifications));

  return (
    <NotificationsClientPage
      currentUser={currentUser}
      initialNotifications={serializedNotifications}
    />
  );
}
