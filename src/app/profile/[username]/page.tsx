import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ProfileView } from "@/components/profile/ProfileView";

export const dynamic = "force-dynamic";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const targetUser = await prisma.user.findUnique({
    where: { username: username.toLowerCase().trim() },
    select: {
      id: true,
      username: true,
      displayName: true,
      profilePhoto: true,
      bio: true,
      createdAt: true,
      _count: {
        select: {
          posts: true,
          followers: true,
          following: true,
        },
      },
      posts: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          imageUrl: true,
          caption: true,
          createdAt: true,
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
      },
    },
  });

  if (!targetUser) {
    notFound();
  }

  const isSelf = currentUser.id === targetUser.id;

  let isFollowing = false;
  if (!isSelf) {
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUser.id,
          followingId: targetUser.id,
        },
      },
    });
    isFollowing = !!follow;
  }

  let savedPosts: any[] = [];
  if (isSelf) {
    const saved = await prisma.savedPost.findMany({
      where: { userId: currentUser.id },
      orderBy: { createdAt: "desc" },
      include: {
        post: {
          select: {
            id: true,
            imageUrl: true,
            caption: true,
            createdAt: true,
            _count: {
              select: {
                likes: true,
                comments: true,
              },
            },
          },
        },
      },
    });
    savedPosts = saved.map((s) => ({
      id: s.post.id,
      imageUrl: s.post.imageUrl,
      caption: s.post.caption,
      createdAt: s.post.createdAt.toISOString(),
      likeCount: s.post._count.likes,
      commentCount: s.post._count.comments,
    }));
  }

  const initialUserData = {
    id: targetUser.id,
    username: targetUser.username,
    displayName: targetUser.displayName,
    profilePhoto: targetUser.profilePhoto,
    bio: targetUser.bio,
    createdAt: targetUser.createdAt.toISOString(),
    postCount: targetUser._count.posts,
    followerCount: targetUser._count.followers,
    followingCount: targetUser._count.following,
    isFollowing,
    isSelf,
  };

  const initialPosts = targetUser.posts.map((p) => ({
    id: p.id,
    imageUrl: p.imageUrl,
    caption: p.caption,
    createdAt: p.createdAt.toISOString(),
    likeCount: p._count.likes,
    commentCount: p._count.comments,
  }));

  return (
    <ProfileView
      initialUserData={initialUserData}
      initialPosts={initialPosts}
      initialSavedPosts={savedPosts}
      currentUser={currentUser}
    />
  );
}
