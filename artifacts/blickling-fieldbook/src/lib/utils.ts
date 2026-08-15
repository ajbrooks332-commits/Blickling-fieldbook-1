import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return ""
  try {
    return format(parseISO(dateString), "dd MMM yyyy, HH:mm")
  } catch (e) {
    return dateString
  }
}

export function formatShortDate(dateString: string | null | undefined): string {
  if (!dateString) return ""
  try {
    return format(parseISO(dateString), "dd MMM")
  } catch (e) {
    return dateString
  }
}

/** Today's date in Europe/London as YYYY-MM-DD (en-CA locale formats ISO-style). */
export function londonToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date())
}

/** True only for a YYYY-MM-DD string naming a real calendar date (rejects 2026-02-31). */
export function isRealCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function getInitials(name: string): string {
  if (!name) return "U"
  const parts = name.split(" ")
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}
