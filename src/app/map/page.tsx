"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function MapPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">
        地図
      </h1>
      <MapView />
    </div>
  );
}
