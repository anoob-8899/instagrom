import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { FeedView } from "@/components/feed/FeedView";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  // Fetch initial posts from SQLite
  const posts = await prisma.post.findMany({
    take: 21,
    orderBy: { createdAt: "desc" },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          displayName: true,
          profilePhoto: true,
        },
      },
      _count: {
        select: {
          likes: true,
          comments: true,
        },
      },
      comments: {
        take: 3,
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              profilePhoto: true,
            },
          },
        },
      },
      likes: {
        where: { userId: currentUser.id },
        select: { userId: true },
      },
      savedBy: {
        where: { userId: currentUser.id },
        select: { userId: true },
      },
    },
  });

  let nextCursor: string | null = null;
  if (posts.length > 20) {
    const nextItem = posts.pop();
    nextCursor = nextItem?.id || null;
  }

  const formattedPosts = posts.map((post) => ({
    id: post.id,
    caption: post.caption,
    imageUrl: post.imageUrl,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: post.author,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    isLiked: (post.likes?.length ?? 0) > 0,
    isSaved: (post.savedBy?.length ?? 0) > 0,
    recentComments: post.comments.reverse().map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      author: c.author,
    })),
  }));

  return (
    <FeedView
      currentUser={currentUser}
      initialPosts={formattedPosts}
      initialCursor={nextCursor}
    />
  );
}
