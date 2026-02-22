import { useRef, useState, useCallback } from "react";
import type { DragEvent } from "react";
import { ImagePlus } from "lucide-react";

interface ImageUploaderProps {
  imageUrl: string | null;
  onImageSelected: (file: File) => void;
  className?: string;
}

export default function ImageUploader({
  imageUrl,
  onImageSelected,
  className = "",
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageSelected(file);
    }
    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) {
        onImageSelected(file);
      }
    },
    [onImageSelected]
  );

  return (
    <div className={className}>
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center gap-3
          min-h-[180px] rounded-xl cursor-pointer
          border-2 border-dashed
          transition-all duration-200
          ${
            isDragging
              ? "border-primary bg-primary/5 scale-[1.02]"
              : "border-secondary/40 hover:border-primary hover:bg-primary/5"
          }
          ${imageUrl ? "p-2" : "p-6"}
        `}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Uploaded preview"
            className="w-full h-full max-h-[300px] object-contain rounded-lg"
          />
        ) : (
          <>
            <ImagePlus
              size={48}
              className="text-secondary/40"
              strokeWidth={1.5}
            />
            <p className="text-sm text-indigo/40 text-center">
              Drop an image here or click to upload
            </p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
