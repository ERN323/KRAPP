import React, { useRef, useState } from 'react'
import { X, Upload, Check, Scale, User, FileText, AtSign } from 'lucide-react'
import { HELMET_OPTIONS, HelmetSvg } from './HelmetIcons'

export interface DriverProfile {
  username: string
  name: string
  surname: string
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
      <div className="bg-[#222222] border border-neutral-700 w-full max-w-md rounded-3xl p-6 shadow-2xl text-white my-auto max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div>
            <h2 className="text-xl font-extrabold tracking-wide text-[#32cd32]">
              DRIVER PROFILE
            </h2>
            <p className="text-xs text-neutral-400">
              Customize your racing identity & telemetry weight
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 mt-5">
          {/* Avatar Preview & Picker */}
          <div className="flex flex-col items-center">
            <div className="w-28 h-28 rounded-full bg-[#3a3a3a] border-4 border-black flex items-center justify-center overflow-hidden shadow-inner mb-3">
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
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-[#32cd32] border border-neutral-700 transition"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Custom Photo
            </button>

            {/* Helmet Selector Grid */}
            <div className="w-full mt-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2 text-center">
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
                      className={`relative p-1.5 rounded-xl border flex flex-col items-center justify-center transition ${
                        isSelected
                          ? 'bg-neutral-800 border-[#32cd32] ring-2 ring-[#32cd32]/40'
                          : 'bg-[#2b2b2b] border-neutral-800 hover:border-neutral-600'
                      }`}
                    >
                      <HelmetSvg helmet={helmet} className="w-9 h-9" />
                      {isSelected && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#32cd32] text-black flex items-center justify-center">
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
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
              Handle (@Username)
            </label>
            <div className="relative">
              <AtSign className="w-4 h-4 text-[#32cd32] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                placeholder="USERNAME"
                className="w-full bg-[#2e2e2e] border border-neutral-700 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-[#32cd32] focus:outline-none focus:border-[#32cd32]"
              />
            </div>
          </div>

          {/* Name & Surname */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="First Name"
                  className="w-full bg-[#2e2e2e] border border-neutral-700 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#32cd32]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Surname
              </label>
              <input
                type="text"
                value={formData.surname}
                onChange={(e) =>
                  setFormData({ ...formData, surname: e.target.value })
                }
                placeholder="Last Name"
                className="w-full bg-[#2e2e2e] border border-neutral-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#32cd32]"
              />
            </div>
          </div>

          {/* Weight (kg) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
              Driver Weight (kg)
            </label>
            <div className="relative">
              <Scale className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                className="w-full bg-[#2e2e2e] border border-neutral-700 rounded-xl pl-10 pr-12 py-2.5 text-sm text-white focus:outline-none focus:border-[#32cd32]"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
                KG
              </span>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
              Driver Bio
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
              <textarea
                rows={3}
                value={formData.bio}
                onChange={(e) =>
                  setFormData({ ...formData, bio: e.target.value })
                }
                placeholder="Home track, racing style, kart class..."
                className="w-full bg-[#2e2e2e] border border-neutral-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#32cd32] resize-none"
              />
            </div>
          </div>

          {/* Save / Cancel Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl font-bold text-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-2xl font-extrabold text-sm bg-[#32cd32] hover:bg-[#28b428] text-black shadow-lg shadow-[#32cd32]/20 transition"
            >
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
