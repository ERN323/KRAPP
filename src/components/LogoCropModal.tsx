import React, { useState, useRef, useEffect } from 'react'
import { X, ZoomIn, ZoomOut, Move, Check } from 'lucide-react'

interface LogoCropModalProps {
  imageSrc: string | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (croppedDataUrl: string) => void
}

export const LogoCropModal: React.FC<LogoCropModalProps> = ({
  imageSrc,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [imageSrc, isOpen])

  if (!isOpen || !imageSrc) return null

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    setOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    })
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  const handleExportCroppedCircle = () => {
    const img = imgRef.current
    if (!img) return

    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Circular clip
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()

    // Background fill
    ctx.fillStyle = '#14191E'
    ctx.fillRect(0, 0, size, size)

    // Calculate cover base scale matching the 208px preview viewport
    const previewSize = 208
    const scaleFactor = size / previewSize
    const imgAspect = img.naturalWidth / (img.naturalHeight || 1)
    let drawW = size
    let drawH = size
    if (imgAspect > 1) {
      drawH = size
      drawW = size * imgAspect
    } else {
      drawW = size
      drawH = size / imgAspect
    }

    drawW *= zoom
    drawH *= zoom

    const drawX = (size - drawW) / 2 + offset.x * scaleFactor
    const drawY = (size - drawH) / 2 + offset.y * scaleFactor

    ctx.drawImage(img, drawX, drawY, drawW, drawH)

    const croppedDataUrl = canvas.toDataURL('image/png', 0.92)
    onConfirm(croppedDataUrl)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="bg-[#1C2228] border border-[#2A323B] w-full max-w-sm rounded-3xl p-5 shadow-2xl text-white flex flex-col items-center">
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-[#2A323B]">
          <div>
            <h3 className="font-display font-extrabold text-lg tracking-wider text-white uppercase">
              ADJUST <span className="text-[#FF6B00]">TEAM LOGO</span>
            </h3>
            <p className="text-[11px] text-[#8A99AD]">
              Drag & zoom to position inside the circle
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-[#14191E] text-[#8A99AD] hover:text-white border border-[#2A323B] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Circular Crop Viewport */}
        <div className="my-5 relative">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="w-52 h-52 rounded-full border-4 border-[#FF6B00] bg-[#14191E] overflow-hidden relative flex items-center justify-center cursor-grab active:cursor-grabbing touch-none shadow-2xl"
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Team Logo Crop Preview"
              draggable={false}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              }}
              className="max-w-none w-52 h-52 object-cover select-none pointer-events-none"
            />
          </div>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8A99AD]">
            <Move className="w-3 h-3 text-[#FF6B00]" />
            <span>Drag image to center</span>
          </div>
        </div>

        {/* Zoom Slider */}
        <div className="w-full flex items-center gap-3 px-2 mb-5">
          <ZoomOut className="w-4 h-4 text-[#8A99AD] shrink-0" />
          <input
            type="range"
            min="0.6"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full accent-[#FF6B00] cursor-pointer"
          />
          <ZoomIn className="w-4 h-4 text-[#FF6B00] shrink-0" />
        </div>

        {/* Action Buttons */}
        <div className="w-full flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full font-display font-extrabold text-sm tracking-wider uppercase border border-white/70 text-white hover:bg-white/5 transition cursor-pointer"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleExportCroppedCircle}
            className="flex-1 py-2.5 rounded-full font-display font-extrabold text-sm tracking-wider uppercase bg-[#FF6B00] hover:bg-[#ff7b1a] text-black flex items-center justify-center gap-1.5 shadow-lg shadow-[#FF6B00]/20 transition cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>APPLY LOGO</span>
          </button>
        </div>
      </div>
    </div>
  )
}
