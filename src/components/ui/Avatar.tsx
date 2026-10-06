"use client";

import React, { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { User as UserIcon } from "lucide-react";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  fallbackName?: string;
  hasStory?: boolean;
}

const sizeClasses = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
  "2xl": "h-28 w-28 text-3xl",
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = "User avatar",
  size = "md",
  className,
  fallbackName,
  hasStory = false,
}) => {
  const [imageError, setImageError] = useState(false);

  const initial = fallbackName
    ? fallbackName.trim().charAt(0).toUpperCase()
    : "";

  const renderContent = () => {
    if (src && !imageError) {
      return (
        <img
          src={src}
          alt={alt}
          onError={() => setImageError(true)}
          className="h-full w-full object-cover rounded-full"
        />
      );
    }

    if (initial) {
      return (
        <span className="font-bold text-slate-700 dark:text-slate-200 select-none">
          {initial}
        </span>
      );
    }

    return <UserIcon className="h-1/2 w-1/2 text-slate-400 dark:text-slate-500" />;
  };

  const avatarElement = (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200/80 dark:ring-slate-700/80",
        sizeClasses[size],
        className
      )}
    >
      {renderContent()}
    </div>
  );

  if (hasStory) {
    return (
      <div className="relative inline-flex p-[2px] rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600">
        <div className="rounded-full bg-white p-[1.5px] dark:bg-slate-950 flex items-center justify-center">
          {avatarElement}
        </div>
      </div>
    );
  }

  return avatarElement;
};
