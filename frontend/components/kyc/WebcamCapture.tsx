"use client"

import React, { useRef, useState, useCallback } from "react"
import Webcam from "react-webcam"
import { Camera, RefreshCcw, Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',')
  const mimeMatch = arr[0].match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, { type: mime })
}

interface WebcamCaptureProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (file: File) => void
}

const videoConstraints = {
  width: 1280,
  height: 720,
  facingMode: "user",
}

export const WebcamCapture: React.FC<WebcamCaptureProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const webcamRef = useRef<Webcam>(null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const shot = webcamRef.current.getScreenshot()
      if (shot) {
        setImageSrc(shot)
      }
    }
  }, [webcamRef])

  const handleConfirm = useCallback(() => {
    if (imageSrc) {
      const selfieFile = dataURLtoFile(imageSrc, "selfie.jpg")
      onCapture(selfieFile)
      onClose()
      setImageSrc(null)
    }
  }, [imageSrc, onCapture, onClose])

  const handleRetake = useCallback(() => {
    setImageSrc(null)
  }, [])

  const handleClose = useCallback(() => {
    setImageSrc(null)
    onClose()
  }, [onClose])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-100 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Camera className="h-5 w-5 text-indigo-500" />
            Capture Identity Photo
          </DialogTitle>
          <DialogDescription className="text-zinc-500 mt-1">
            {imageSrc
              ? "Review your photo and ensure it is clear and well-lit."
              : "Position yourself within the frame for a clear selfie."}
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-video bg-black w-full min-h-[300px] flex items-center justify-center m-0">
          {!imageSrc ? (
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              className="h-full w-full object-cover"
              mirrored
            />
          ) : (
            <img
              src={imageSrc}
              alt="Captured"
              className="h-full w-full object-cover animate-in fade-in duration-300"
            />
          )}

          {/* Guide Overlay */}
          {!imageSrc && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-80 border-2 border-dashed border-indigo-500/50 rounded-[45%] bg-indigo-500/5 backdrop-blur-[2px]" />
            </div>
          )}
        </div>

        <DialogFooter className="p-6 flex flex-col sm:flex-row gap-3">
          {!imageSrc ? (
            <Button
              onClick={capture}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white border-none py-6 text-lg font-medium"
            >
              <Camera className="mr-2 h-5 w-5" />
              Capture Photo
            </Button>
          ) : (
            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                onClick={handleRetake}
                className="flex-1 bg-transparent border-zinc-800 hover:bg-zinc-900 text-zinc-300 py-6"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Retake
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white border-none py-6"
              >
                <Check className="mr-2 h-4 w-4" />
                Confirm & Use
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
