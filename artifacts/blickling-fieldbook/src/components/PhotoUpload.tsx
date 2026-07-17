import React, { useRef, useState } from "react"
import imageCompression from "browser-image-compression"
import { Camera, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PhotoUploadProps {
  onUploaded: (image: { storageKey: string; originalFilename: string; mimeType: string; fileSize: number }) => void
  disabled?: boolean
  label?: string
}

export default function PhotoUpload({ onUploaded, disabled, label = "Take / Add Photo" }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setUploading(true)

    try {
      // Compress image
      const compressed = await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      })

      // Request presigned upload URL
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: compressed.size,
          contentType: compressed.type || file.type,
        }),
      })

      if (!urlRes.ok) {
        throw new Error("Failed to get upload URL")
      }

      const { uploadURL, objectPath } = await urlRes.json()

      // PUT file bytes to presigned URL
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: compressed,
        headers: { "Content-Type": compressed.type || file.type },
      })

      if (!putRes.ok) {
        throw new Error("Failed to upload image")
      }

      onUploaded({
        storageKey: objectPath,
        originalFilename: file.name,
        mimeType: compressed.type || file.type,
        fileSize: compressed.size,
      })
    } catch (err: any) {
      setError(err?.message || "Upload failed. Please try again.")
    } finally {
      setUploading(false)
      // Reset input so same file can be selected again
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full h-14 flex items-center justify-center gap-3 text-base border-primary/30 hover:bg-primary/5 hover:border-primary"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
      >
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span>Uploading…</span>
          </>
        ) : (
          <>
            <Camera className="w-5 h-5 text-primary" />
            <span>{label}</span>
          </>
        )}
      </Button>
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {error}
        </div>
      )}
    </div>
  )
}
