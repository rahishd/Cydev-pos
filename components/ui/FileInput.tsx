"use client";

import { useState, useRef } from "react";
import { Button } from "./Button";

interface FileInputProps {
  onFileSelect: (url: string, name: string) => void;
  onError?: (error: string) => void;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
  currentUrl?: string;
  currentName?: string;
}

export function FileInput({
  onFileSelect,
  onError,
  accept = ".jpg,.jpeg,.png,.pdf",
  maxSize = 5 * 1024 * 1024,
  disabled = false,
  currentUrl,
  currentName,
}: FileInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState(currentName || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > maxSize) {
      onError?.("File size exceeds limit");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const { url, name } = await response.json();
      setFileName(file.name);
      onFileSelect(url, name);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleClear = async () => {
    if (currentUrl) {
      try {
        await fetch("/api/upload", {
          method: "DELETE",
          body: JSON.stringify({ pathname: currentName }),
        });
      } catch (error) {
        console.error("Failed to delete file:", error);
      }
    }
    setFileName("");
    onFileSelect("", "");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={disabled || isUploading}
        className="hidden"
      />

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400"
        } ${disabled || isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
      >
        <div className="text-sm text-gray-600">
          <p className="font-medium">
            {isUploading ? "Uploading..." : "Drag and drop your file here"}
          </p>
          <p className="text-xs text-gray-500">
            or click to select (JPG, PNG, PDF - max 5MB)
          </p>
        </div>
      </div>

      {fileName && (
        <div className="flex items-center justify-between bg-gray-100 p-3 rounded-lg">
          <p className="text-sm text-gray-700 truncate">{fileName}</p>
          {!isUploading && (
            <button
              onClick={handleClear}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Remove
            </button>
          )}
        </div>
      )}

      {currentUrl && !fileName && (
        <div className="flex items-center justify-between bg-gray-100 p-3 rounded-lg">
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-700 underline truncate"
          >
            View current receipt
          </a>
          {!isUploading && (
            <button
              onClick={handleClear}
              className="text-xs text-red-600 hover:text-red-700 font-medium ml-2"
            >
              Replace
            </button>
          )}
        </div>
      )}
    </div>
  );
}
