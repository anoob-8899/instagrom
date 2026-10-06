"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ProfileHeader } from "./ProfileHeader";
import { PostGrid } from "./PostGrid";
import { EditProfileModal } from "./EditProfileModal";

interface ProfileViewProps {
  initialUserData: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
    bio?: string | null;
    createdAt: string | Date;
    postCount: number;
    followerCount: number;
    followingCount: number;
    isFollowing: boolean;
    isSelf: boolean;
  };
  initialPosts: any[];
  initialSavedPosts?: any[];
  currentUser: {
    id: string;
    username: string;
    displayName: string;
    profilePhoto?: string | null;
  };
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  initialUserData,
  initialPosts,
  initialSavedPosts = [],
  currentUser,
}) => {
  const [userData, setUserData] = useState(initialUserData);
  const [posts, setPosts] = useState(initialPosts);
  const [savedPosts, setSavedPosts] = useState(initialSavedPosts);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleProfileUpdated = (updatedUser: any) => {
    setUserData((prev) => ({
      ...prev,
      displayName: updatedUser.displayName,
      bio: updatedUser.bio,
      profilePhoto: updatedUser.profilePhoto,
    }));
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setSavedPosts((prev) => prev.filter((p) => p.id !== postId));
    setUserData((prev) => ({
      ...prev,
      postCount: Math.max(0, prev.postCount - 1),
    }));
  };

  const handleFollowToggled = (isFollowing: boolean, followerCount: number) => {
    setUserData((prev) => ({
      ...prev,
      isFollowing,
      followerCount,
    }));
  };

  return (
    <AppShell user={currentUser}>
      <div className="max-w-4xl mx-auto space-y-8 py-2">
        {/* Profile Header */}
        <ProfileHeader
          user={userData}
          currentUser={currentUser}
          onEditProfileClick={() => setIsEditOpen(true)}
          onFollowToggled={handleFollowToggled}
        />

        {/* Posts & Saved Grid */}
        <PostGrid
          posts={posts}
          savedPosts={savedPosts}
          isSelf={userData.isSelf}
          currentUser={currentUser}
          onPostDeleted={handlePostDeleted}
        />

        {/* Edit Profile Modal */}
        {userData.isSelf && (
          <EditProfileModal
            isOpen={isEditOpen}
            onClose={() => setIsEditOpen(false)}
            currentUser={{
              id: userData.id,
              username: userData.username,
              displayName: userData.displayName,
              profilePhoto: userData.profilePhoto,
              bio: userData.bio,
            }}
            onProfileUpdated={handleProfileUpdated}
          />
        )}
      </div>
    </AppShell>
  );
};
