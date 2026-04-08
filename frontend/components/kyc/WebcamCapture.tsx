"use client"

import React, { useRef, useState, useCallback } from "react"
import Webcam from "react-webcam"
import { Camera, RefreshCcw, Check, UploadCloud, AlertTriangle, X } from "lucide-react"
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

type CameraMode = 'camera' | 'upload' | 'error'

export const WebcamCapture: React.FC<WebcamCaptureProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [mode, setMode] = useState<CameraMode>('camera')
  const [cameraError, setCameraError] = useState<string | null>(null)

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
    setMode('camera')
    setCameraError(null)
    onClose()
  }, [onClose])

  const handleUserMediaError = useCallback((err: string | DOMException) => {
    const msg = typeof err === 'string' ? err : err.message
    if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
      setCameraError('Camera access denied. Please allow camera access in your browser settings, or use the file upload option below.')
    } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
      setCameraError('No camera found on this device. Please use the file upload option to upload your selfie.')
    } else {
      setCameraError(`Camera unavailable: ${msg}. Please use the file upload option.`)
    }
    setMode('error')
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPG or PNG)')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Image too large. Maximum 10 MB.')
      return
    }
    onCapture(file)
    onClose()
    setMode('camera')
    setCameraError(null)
    e.target.value = ''
  }, [onCapture, onClose])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-100 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Camera className="h-5 w-5 text-indigo-500" />
            Capture Identity Photo
          </DialogTitle>
          <DialogDescription className="text-zinc-500 mt-1">
            {mode === 'error'
              ? 'Camera unavailable — please upload a selfie photo instead.'
              : imageSrc
              ? 'Review your photo and ensure it is clear and well-lit.'
              : 'Position yourself within the frame for a clear selfie.'}
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-2 px-6 pt-4">
          <button
            onClick={() => { setMode('camera'); setCameraError(null); setImageSrc(null) }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              mode !== 'upload'
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Camera className="h-3 w-3" />
            Use Camera
          </button>
          <button
            onClick={() => { setMode('upload'); setImageSrc(null) }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              mode === 'upload'
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UploadCloud className="h-3 w-3" />
            Upload Photo
          </button>
        </div>

        {/* Camera mode */}
        {mode !== 'upload' && (
          <div className="relative aspect-video bg-black w-full min-h-[280px] flex items-center justify-center m-0 mt-4">
            {mode === 'error' ? (
              <div className="flex flex-col items-center gap-4 p-8 text-center">
                <div className="p-4 bg-rose-500/20 rounded-full">
                  <AlertTriangle className="h-8 w-8 text-rose-400" />
                </div>
                <p className="text-sm text-zinc-300 max-w-sm">{cameraError}</p>
                <Button
                  onClick={() => setMode('upload')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white border-none"
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Upload a Photo Instead
                </Button>
              </div>
            ) : !imageSrc ? (
              <>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  className="h-full w-full object-cover"
                  mirrored
                  onUserMediaError={handleUserMediaError}
                />
                {/* Guide Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-56 h-72 border-2 border-dashed border-indigo-500/60 rounded-[45%] bg-indigo-500/5 backdrop-blur-[1px]" />
                </div>
              </>
            ) : (
              <img
                src={imageSrc}
                alt="Captured"
                className="h-full w-full object-cover animate-in fade-in duration-300"
              />
            )}
          </div>
        )}

        {/* Upload mode */}
        {mode === 'upload' && (
          <div className="p-6">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-zinc-700 hover:border-indigo-500 rounded-2xl bg-zinc-900/50 cursor-pointer transition-colors group"
            >
              <div className="p-4 bg-zinc-800 group-hover:bg-indigo-500/20 rounded-full mb-4 transition-colors">
                <UploadCloud className="h-8 w-8 text-zinc-400 group-hover:text-indigo-400 transition-colors" />
              </div>
              <p className="text-sm font-semibold text-zinc-300 group-hover:text-white transition-colors">
                Click to upload your selfie photo
              </p>
              <p className="text-xs text-zinc-500 mt-1">JPG, PNG or WebP · Max 10 MB</p>
              <p className="text-xs text-indigo-400/70 mt-3 text-center max-w-xs">
                Make sure it&apos;s a clear, front-facing photo of your face with good lighting
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="p-6 pt-4 flex flex-col sm:flex-row gap-3">
          {mode === 'camera' && !imageSrc && (
            <Button
              onClick={capture}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white border-none py-6 text-lg font-medium"
            >
              <Camera className="mr-2 h-5 w-5" />
              Capture Photo
            </Button>
          )}
          {mode === 'camera' && imageSrc && (
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
                Confirm &amp; Use
              </Button>
            </div>
          )}
          {mode === 'error' && (
            <Button
              variant="outline"
              onClick={handleClose}
              className="w-full border-zinc-800 hover:bg-zinc-900 text-zinc-300 py-6"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
