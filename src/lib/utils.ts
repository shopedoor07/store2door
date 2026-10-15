// ============================================================
// Store2Door — Utility Functions
// ============================================================
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format price in INR
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generate order number: S2D-YYYYMMDD-XXXXX
 */
export function generateOrderNumber(sequence: number): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `S2D-${dateStr}-${String(sequence).padStart(5, '0')}`;
}

/**
 * Generate parcha slip number: SLIP-YYYYMMDD-XXXXX
 */
export function generateSlipNumber(sequence: number): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `SLIP-${dateStr}-${String(sequence).padStart(5, '0')}`;
}

/**
 * Generate slug from string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Format date for display (IST)
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Format date+time for display (IST)
 */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Get start and end of day in UTC for IST date
 */
export function getISTDayBounds(date: Date = new Date()) {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);
  const startOfDay = new Date(istDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(istDate);
  endOfDay.setUTCHours(23, 59, 59, 999);
  return {
    start: new Date(startOfDay.getTime() - istOffset).toISOString(),
    end: new Date(endOfDay.getTime() - istOffset).toISOString(),
  };
}

/**
 * Validate quantity against MOQ and step
 */
export function validateQuantity(
  quantity: number,
  moq: number,
  step: number
): { valid: boolean; message?: string; corrected?: number } {
  if (quantity < moq) {
    return { valid: false, message: `Minimum order quantity is ${moq}`, corrected: moq };
  }
  if ((quantity - moq) % step !== 0) {
    const corrected = moq + Math.ceil((quantity - moq) / step) * step;
    return { valid: false, message: `Quantity must be in steps of ${step}`, corrected };
  }
  return { valid: true };
}

/**
 * Calculate effective price for a variant
 */
export function getEffectivePrice(variant: {
  wholesale_price: number;
  offer_price: number | null;
}): number {
  if (variant.offer_price !== null && variant.offer_price > 0 && variant.offer_price < variant.wholesale_price) {
    return variant.offer_price;
  }
  return variant.wholesale_price;
}

/**
 * Calculate discount percentage
 */
export function getDiscountPercentage(mrp: number, price: number): number {
  if (mrp <= 0 || price >= mrp) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

/**
 * Calculate available stock
 */
export function getAvailableStock(stock: number, reserved: number): number {
  return Math.max(0, stock - reserved);
}

/**
 * Debounce function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
