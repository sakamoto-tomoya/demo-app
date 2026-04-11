export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "visited" | "no_show";

export type PaymentMethod = "onsite_cash" | "credit_card";
export type PaymentStatus = "pending_onsite" | "completed" | "failed" | "refunded" | "cancelled";

export type NotificationStatus = "scheduled" | "sent" | "failed" | "cancelled";

export interface RestaurantMenu {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  minPeople: number;
  maxPeople: number;
  isActive: boolean;
  imageUrl?: string;
}

export interface RestaurantReservation {
  id: string;
  reservationNumber: string;
  customerName: string;
  phone: string;
  email: string;
  reservationDate: string; // yyyy-mm-dd
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  peopleCount: number;
  menuId: string;
  menuName: string;
  note?: string;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  visitedAt?: string;
  // 支払い情報
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  totalAmount?: number;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  stripeRefundId?: string;
  cancellationDate?: string;
}

export interface AvailabilitySlot {
  startTime: string;
  endTime: string;
  remainingSeats: number;
}

export interface RestaurantNotification {
  id: string;
  reservationId: string;
  notificationType: string;
  channel: string;
  scheduledAt?: string;
  sentAt?: string;
  status: NotificationStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
