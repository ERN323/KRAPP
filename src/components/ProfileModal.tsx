import React, { useRef, useState } from 'react'
import { X, Upload, Check, Scale, User, FileText, AtSign, Hash } from 'lucide-react'
import { HELMET_OPTIONS, HelmetSvg } from './HelmetIcons'

export interface DriverProfile {
  username: string
  name: string
  surname: string
  driverNumber?: string
  weightKg: string
  bio: string
  avatarType: 'helmet' | 'custom' | 'none'
  helmetId: string
  customAvatarDataUrl: string | null
}

interface ProfileModalProps {
  profile: DriverProfile
  isOpen: boolean
  onClose: () => void
  onSave: (updated: DriverProfile) => void
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  profile,
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<DriverProfile>(profile)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormData((prev) => ({
          ...prev,
          avatarType: 'custom',
          customAvatarDataUrl: reader.result as string,
        }))
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanUsername = formData.username.trim().replace(/^@+/, '') || 'USERNAME'
    onSave({
      ...formData,
      username: cleanUsername.toUpperCase(),
    })
    onClose()
  }

  const selectedHelmet =
    HELMET_OPTIONS.find((h) => h.id === formData.helmetId) || HELMET_OPTIONS[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#1C2228] border border-[#2A323B] w-full max-w-md rounded-2xl p-6 shadow-2xl text-white my-auto max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#2A323B]">
          <div>
            <h2 className="text-xl font-extrabold tracking-wider text-white font-display uppercase">
              DRIVER <span className="text-[#FF6B00]">PROFILE</span>
            </h2>
            <p className="text-xs text-[#8A99AD]">
              Customize your racing identity, driver number & weight
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-[#14191E] hover:bg-[#252D35] text-[#8A99AD] hover:text-white border border-[#2A323B] transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-5">
          {/* Avatar Preview & Picker */}
          <div className="flex flex-col items-center">
            <div className="w-28 h-28 rounded-full bg-[#14191E] border-2 border-[#FF6B00] flex items-center justify-center overflow-hidden shadow-lg shadow-[#FF6B00]/10 mb-3">
              {formData.avatarType === 'custom' && formData.customAvatarDataUrl ? (
                <img
                  src={formData.customAvatarDataUrl}
                  alt="Driver Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <HelmetSvg helmet={selectedHelmet} className="w-20 h-20" />
              )}
            </div>

            {/* Upload Own Picture Button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full bg-[#14191E] hover:bg-[#252D35] text-[#FF6B00] border border-[#2A323B] transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Custom Photo
            </button>

            {/* Helmet Selector Grid */}
            <div className="w-full mt-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8A99AD] mb-2 text-center">
                Or Pick a Racing Helmet Icon
              </label>
              <div className="grid grid-cols-6 gap-2">
                {HELMET_OPTIONS.map((helmet) => {
                  const isSelected =
                    formData.avatarType === 'helmet' &&
                    formData.helmetId === helmet.id
                  return (
                    <button
                      key={helmet.id}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          avatarType: 'helmet',
                          helmetId: helmet.id,
                        }))
                      }
                      title={helmet.name}
                      className={`relative p-1.5 rounded-xl border flex flex-col items-center justify-center transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#14191E] border-[#FF6B00] ring-2 ring-[#FF6B00]/30'
                          : 'bg-[#14191E]/60 border-[#2A323B] hover:border-[#3E4A56]'
                      }`}
                    >
                      <HelmetSvg helmet={helmet} className="w-9 h-9" />
                      {isSelected && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF6B00] text-black flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* @Username */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8A99AD] mb-1.5">
              Handle (@Username)
            </label>
            <div className="relative">
              <AtSign className="w-4 h-4 text-[#FF6B00] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                placeholder="USERNAME"
                className="w-full bg-[#14191E] border border-[#2A323B] rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-white uppercase focus:outline-none focus:border-[#FF6B00]"
              />
            </div>
          </div>

          {/* Name & Surname */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8A99AD] mb-1.5">
                Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#8A99AD] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="First Name"
                  className="w-full bg-[#14191E] border border-[#2A323B] rounded-xl pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF6B00]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8A99AD] mb-1.5">
                Surname
              </label>
              <input
                type="text"
                value={formData.surname}
                onChange={(e) =>
                  setFormData({ ...formData, surname: e.target.value })
                }
                placeholder="Last Name"
                className="w-full bg-[#14191E] border border-[#2A323B] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF6B00]"
              />
            </div>
          </div>

          {/* Driver Number & Weight (kg) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8A99AD] mb-1.5">
                Driver Number
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-[#FF6B00] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.driverNumber || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, driverNumber: e.target.value })
                  }
                  placeholder="e.g. 44"
                  className="w-full bg-[#14191E] border border-[#2A323B] rounded-xl pl-10 pr-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-[#FF6B00]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8A99AD] mb-1.5">
                Weight (kg)
              </label>
              <div className="relative">
                <Scale className="w-4 h-4 text-[#8A99AD] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.5"
                  min="20"
                  max="200"
                  value={formData.weightKg}
                  onChange={(e) =>
                    setFormData({ ...formData, weightKg: e.target.value })
                  }
                  placeholder="e.g. 76.5"
                  className="w-full bg-[#14191E] border border-[#2A323B] rounded-xl pl-10 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF6B00]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#FF6B00]">
                  KG
                </span>
              </div>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8A99AD] mb-1.5">
              Driver Bio
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-[#8A99AD] absolute left-3.5 top-3" />
              <textarea
                rows={3}
                value={formData.bio}
                onChange={(e) =>
                  setFormData({ ...formData, bio: e.target.value })
                }
                placeholder="Home track, racing style, kart class..."
                className="w-full bg-[#14191E] border border-[#2A323B] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF6B00] resize-none"
              />
            </div>
          </div>

          {/* Save / Cancel Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-full font-bold text-xs uppercase tracking-wider bg-transparent border border-white/80 hover:bg-white/5 text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-full font-extrabold text-xs uppercase tracking-wider bg-[#FF6B00] hover:bg-[#ff7b1a] text-black shadow-lg shadow-[#FF6B00]/25 transition cursor-pointer"
            >
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
