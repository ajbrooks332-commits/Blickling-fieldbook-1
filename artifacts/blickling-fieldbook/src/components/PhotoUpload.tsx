import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/api";
import type { OfflinePhoto } from "@/lib/offline";

export type PhotoUploadResult = OfflinePhoto & { storageKey?: string; previewUrl?: string };

interface PhotoUploadProps {
  onUploaded: (image: PhotoUploadResult) => void;
  disabled?: boolean;
  label?: string;
  deferUpload?: boolean;
}

export default function PhotoUpload({ onUploaded, disabled, label = "Take / Add Photo", deferUpload = false }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null); setUploading(true);
    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPEG, PNG or WebP image.");
      if (file.size > 10 * 1024 * 1024) throw new Error("The original image must be 10 MB or smaller.");
      const compressed = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 2560, useWebWorker: true, fileType: "image/webp" });
      const photo: OfflinePhoto = { blob: compressed, originalFilename: file.name, mimeType: "image/webp", fileSize: compressed.size };
      if (deferUpload) {
        onUploaded({ ...photo, previewUrl: URL.createObjectURL(compressed) });
        return;
      }
      const grant = await apiJson<{ uploadURL: string; objectPath: string }>("/api/storage/uploads/request-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: photo.originalFilename, size: photo.fileSize, contentType: photo.mimeType }),
      });
      const uploaded = await fetch(grant.uploadURL, { method: "PUT", body: compressed, headers: { "Content-Type": photo.mimeType } });
      if (!uploaded.ok) throw new Error("Photo upload failed.");
      onUploaded({ ...photo, storageKey: grant.objectPath });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return <div className="space-y-2">
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden"
      onChange={handleFileChange} disabled={disabled || uploading} />
    <Button type="button" variant="outline" className="w-full h-14 flex items-center justify-center gap-3 text-base border-primary/30 hover:bg-primary/5 hover:border-primary"
      onClick={() => inputRef.current?.click()} disabled={disabled || uploading}>
      {uploading ? <><Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none text-primary" /><span>Preparing…</span></>
        : <><Camera className="w-5 h-5 text-primary" /><span>{label}</span></>}
    </Button>
    {error && <div role="alert" className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{error}</div>}
  </div>;
}
