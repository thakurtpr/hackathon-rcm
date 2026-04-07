"use client"

import React, { useCallback } from "react"
import { useDropzone } from "react-dropzone"
import {
  UploadCloud,
  CheckCircle,
  XCircle,
  Loader2,
  Camera,
  RefreshCcw,
  FileText,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface DocumentCardProps {
  docType: string
  acceptedFiles: Record<string, string[]>
  status: "pending" | "uploading" | "uploaded" | "verified" | "failed"
  fileName: string | null
  error: string | null
  onFileSelect: (file: File) => void
  onOpenCamera?: () => void
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  docType,
  acceptedFiles,
  status,
  fileName,
  error,
  onFileSelect,
  onOpenCamera,
}) => {
  const onDrop = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        onFileSelect(files[0])
      }
    },
    [onFileSelect]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: status !== "pending",
    accept: acceptedFiles,
  })

  const isSelfie = docType.toLowerCase().includes("selfie")

  return (
    <Card className="w-full bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 overflow-hidden transition-all duration-300 hover:border-indigo-300 dark:hover:border-zinc-700 shadow-sm dark:shadow-xl transition-colors">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <FileText className="h-5 w-5 text-zinc-400" />
            {docType}
          </CardTitle>
          {(status === "verified" || status === "uploaded") && (
            <CheckCircle className="h-5 w-5 text-emerald-500 animate-in zoom-in duration-300" />
          )}
          {status === "failed" && (
            <XCircle className="h-5 w-5 text-rose-500 animate-in zoom-in duration-300" />
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isSelfie ? (
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-950/50 space-y-4">
            <div className="p-4 bg-zinc-800 rounded-full">
              <Camera className="h-8 w-8 text-zinc-400" />
            </div>
            <p className="text-sm text-zinc-400 text-center">
              Please take a clear photo of your face for verification.
            </p>
            <Button
              onClick={onOpenCamera}
              className="bg-indigo-600 hover:bg-indigo-500 text-white border-none"
            >
              <Camera className="mr-2 h-4 w-4" />
              Open Camera
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {status === "pending" && (
              <div
                {...getRootProps()}
                className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                  isDragActive
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-500/5"
                    : "border-gray-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-zinc-700 bg-gray-50 dark:bg-zinc-950/50"
                }`}
              >
                <input {...getInputProps()} />
                <div className="p-3 bg-gray-100 dark:bg-zinc-800 rounded-full mb-3 transition-colors">
                  <UploadCloud className="h-6 w-6 text-gray-500 dark:text-zinc-400" />
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-zinc-200 transition-colors">
                  {isDragActive ? "Drop the file here" : "Drag & drop or click to upload"}
                </p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1 transition-colors">
                  Supported: {Object.values(acceptedFiles).flat().join(", ") || "JPG, PNG, PDF"}
                </p>
              </div>
            )}

            {status === "uploading" && (
              <div className="flex flex-col items-center justify-center p-10 bg-zinc-950/50 rounded-xl border border-zinc-800">
                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-3" />
                <p className="text-sm text-zinc-400">Uploading document...</p>
              </div>
            )}

            {(status === "verified" || status === "uploaded") && (
              <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-400 truncate">
                    Verified Successfully
                  </p>
                  <p className="text-xs text-zinc-500 truncate">{fileName}</p>
                </div>
              </div>
            )}

            {status === "failed" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <div className="p-2 bg-rose-500/20 rounded-lg">
                    <XCircle className="h-5 w-5 text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-rose-400">
                      Verification Failed
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{error}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={onOpenCamera} // Re-opening camera/picker usually triggers retry logic in parent
                  className="w-full border-zinc-800 hover:bg-zinc-800 text-zinc-300"
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
