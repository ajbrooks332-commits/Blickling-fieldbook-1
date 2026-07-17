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

export function getInitials(name: string): string {
  if (!name) return "U"
  const parts = name.split(" ")
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}
