import React, { useState } from "react"
import { X, ImageIcon } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface PhotoGalleryProps {
  images: Array<{ id: number; storageKey: string; originalFilename: string; caption?: string | null; mimeType: string }>
  onDelete?: (imageId: number) => void
  editable?: boolean
}

export default function PhotoGallery({ images, onDelete, editable }: PhotoGalleryProps) {
  const [lightbox, setLightbox] = useState<{ storageKey: string; caption?: string | null } | null>(null)

  if (images.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center gap-2">
        <ImageIcon className="w-8 h-8 opacity-40" />
        No photos yet
      </div>
    )
  }

  return (
    <>
      <p className="text-sm text-muted-foreground mb-3">{images.length} photo{images.length !== 1 ? "s" : ""}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {images.map((img) => {
          // storageKey starts with /objects/, serve via /api/storage/objects/...
          const src = `/api/storage${img.storageKey}`
          return (
            <div key={img.id} className="relative group rounded-lg overflow-hidden border bg-muted">
              <img
                src={src}
                alt={img.caption || img.originalFilename}
                className="w-full aspect-square object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setLightbox({ storageKey: img.storageKey, caption: img.caption })}
              />
              {editable && onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(img.id) }}
                  className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Delete photo"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              {img.caption && (
                <p className="text-xs text-muted-foreground px-2 py-1 truncate">{img.caption}</p>
              )}
            </div>
          )
        })}
      </div>

      <Dialog open={!!lightbox} onOpenChange={(open) => { if (!open) setLightbox(null) }}>
        <DialogContent className="max-w-3xl p-2 bg-black/95 border-black">
          {lightbox && (
            <div className="flex flex-col items-center gap-2">
              <img
                src={`/api/storage${lightbox.storageKey}`}
                alt={lightbox.caption || "Photo"}
                className="max-h-[80vh] w-auto object-contain rounded"
              />
              {lightbox.caption && (
                <p className="text-sm text-white/80 text-center px-4">{lightbox.caption}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
