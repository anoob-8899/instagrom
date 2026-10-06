import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { PostCard } from "@/components/feed/PostCard";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

interface PostPageProps {
  params: Promise<{ id: string }>;
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect(`/login?redirect=/post/${id}`);
  }

  const post = await prisma.post.findUnique({
    where: { id },
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
        orderBy: { createdAt: "asc" },
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

  if (!post) {
    notFound();
  }

  const formattedPost = {
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
    recentComments: post.comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      author: c.author,
    })),
  };

  return (
    <AppShell user={currentUser}>
      <div className="max-w-xl mx-auto space-y-4 py-2">
        <Link
          href="/feed"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to feed
        </Link>
        <PostCard post={formattedPost} currentUser={currentUser} />
      </div>
    </AppShell>
  );
}
