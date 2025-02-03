// src/enums/order-status.enum.ts
export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
  UNPAID = 'NOTPAY',
  PAID = 'SUCCESS',
}
