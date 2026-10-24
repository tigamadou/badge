"use client";

import { useEffect, useRef, useState } from "react";

function initials(name: string | null) {
  const words = (name ?? "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function UserAvatarView({
  name,
  photoUrl,
  size,
  onError,
  imgRef,
}: {
  name: string | null;
  photoUrl: string | null;
  size: number;
  onError?: () => void;
  imgRef?: React.Ref<HTMLImageElement>;
}) {
  return (
    <span
      data-testid="user-avatar"
      aria-hidden={photoUrl ? undefined : "true"}
      className="flex flex-none items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xs font-semibold text-slate-600"
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={photoUrl}
          alt="Photo de profil"
          className="h-full w-full object-cover"
          onError={onError}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function UserAvatar({
  name,
  photoUrl,
  size = 32,
}: {
  name: string | null;
  photoUrl?: string | null;
  size?: number;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // L'image a pu échouer avant que React attache onError (avant l'hydratation).
  useEffect(() => {
    const img = imgRef.current;
    if (photoUrl && img && img.complete && img.naturalWidth === 0) setFailedUrl(photoUrl);
  }, [photoUrl]);

  const shown = photoUrl && photoUrl !== failedUrl ? photoUrl : null;
  return (
    <UserAvatarView
      name={name}
      photoUrl={shown}
      size={size}
      imgRef={imgRef}
      onError={() => setFailedUrl(photoUrl ?? null)}
    />
  );
}
