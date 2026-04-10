"use client";

import type { AvailabilitySlot, RestaurantMenu, RestaurantReservation } from "@/lib/restaurant-types";
import type { RestaurantNotification, ReservationStatus } from "@/lib/restaurant-types";

export async function fetchRestaurantMenus(): Promise<RestaurantMenu[]> {
  const res = await fetch("/api/restaurant/menus", { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { ok?: boolean; menus?: RestaurantMenu[] };
  return data.ok && Array.isArray(data.menus) ? data.menus : [];
}

export async function fetchAvailability(args: {
  date: string;
  menuId: string;
  peopleCount: number;
}): Promise<{ slots: AvailabilitySlot[]; reason?: string }> {
  const sp = new URLSearchParams({
    date: args.date,
    menuId: args.menuId,
    peopleCount: String(args.peopleCount),
  });
  const res = await fetch(`/api/restaurant/availability?${sp.toString()}`, { cache: "no-store" });
  if (!res.ok) return { slots: [], reason: "空き枠の取得に失敗しました。" };
  const data = (await res.json()) as { ok?: boolean; slots?: AvailabilitySlot[]; reason?: string };
  return data.ok ? { slots: data.slots ?? [], reason: data.reason } : { slots: [], reason: data.reason };
}

export async function createRestaurantReservation(args: {
  menuId: string;
  date: string;
  startTime: string;
  peopleCount: number;
  customerName: string;
  phone: string;
  email: string;
  note?: string;
}): Promise<{ ok: boolean; reservation?: RestaurantReservation; error?: string }> {
  const res = await fetch("/api/restaurant/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    reservation?: RestaurantReservation;
    error?: string;
  };
  return { ok: !!data.ok, reservation: data.reservation, error: data.error };
}

export async function fetchRestaurantReservations(params?: {
  date?: string;
  status?: string;
}): Promise<RestaurantReservation[]> {
  const sp = new URLSearchParams();
  if (params?.date) sp.set("date", params.date);
  if (params?.status) sp.set("status", params.status);
  const qs = sp.toString();
  const res = await fetch(`/api/restaurant/reservations${qs ? `?${qs}` : ""}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { ok?: boolean; reservations?: RestaurantReservation[] };
  return data.ok && Array.isArray(data.reservations) ? data.reservations : [];
}

export async function cancelRestaurantReservation(args: {
  reservationNumber: string;
  email: string;
  reason?: string;
}): Promise<{ ok: boolean; reservation?: RestaurantReservation; error?: string }> {
  const res = await fetch("/api/restaurant/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    reservation?: RestaurantReservation;
    error?: string;
  };
  return { ok: !!data.ok, reservation: data.reservation, error: data.error };
}

export async function runRestaurantReminders(): Promise<{ ok: boolean; sent?: number; targets?: number; error?: string }> {
  const res = await fetch("/api/restaurant/reminders/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = (await res.json()) as { ok?: boolean; sent?: number; targets?: number; error?: string };
  return { ok: !!data.ok, sent: data.sent, targets: data.targets, error: data.error };
}

export async function updateRestaurantReservationStatus(args: {
  id: string;
  status: ReservationStatus;
}): Promise<{ ok: boolean; reservation?: RestaurantReservation; error?: string }> {
  const res = await fetch("/api/restaurant/reservations", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const data = (await res.json()) as { ok?: boolean; reservation?: RestaurantReservation; error?: string };
  return { ok: !!data.ok, reservation: data.reservation, error: data.error };
}

export async function fetchRestaurantNotifications(limit: number = 200): Promise<RestaurantNotification[]> {
  const res = await fetch(`/api/restaurant/notifications?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { ok?: boolean; notifications?: RestaurantNotification[] };
  return data.ok && Array.isArray(data.notifications) ? data.notifications : [];
}
