"use client";

import { useState } from "react";

/** `public/images/about/profile.webp`（差し替え時は同パスに上書き） */
const PRIMARY = "/images/about/profile.webp";
const FALLBACK = "/images/about/profile-placeholder.svg";

export function ProfilePhoto() {
  const [src, setSrc] = useState(PRIMARY);

  return (
    <img
      src={src}
      alt="坂本知也"
      width={220}
      height={293}
      className="h-full w-full object-cover object-top"
      onError={() => setSrc(FALLBACK)}
    />
  );
}
