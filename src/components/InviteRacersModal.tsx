import React, { useState } from 'react'
import { X, Copy, Check, Share2, Lock, Globe, QrCode, MessageCircle, Send } from 'lucide-react'
import { League } from '../lib/leaguesRepo'
import { QrCodeSvg } from './QrCodeSvg'

interface InviteRacersModalProps {
  league: League | null
  isOpen: boolean
  loadingPassword?: boolean
  invitePassword: string | null
  onClose: () => void
}

export const InviteRacersModal: React.FC<InviteRacersModalProps> = ({
  league,
  isOpen,
  loadingPassword = false,
  invitePassword,
  onClose,
}) => {
  const [copied, setCopied] = useState(false)

  if (!isOpen || !league) return null

  const baseAppUrl = `${window.location.origin}${window.location.pathname}`
  const effectivePassword = league.isPrivate
    ? invitePassword || league.id.replace(/-/g, '').slice(0, 6).toUpperCase()
    : null

  const inviteUrl =
    league.isPrivate && effectivePassword
      ? `${baseAppUrl}?inviteLeague=${encodeURIComponent(league.id)}&pwd=${encodeURIComponent(effectivePassword)}`
      : `${baseAppUrl}?inviteLeague=${encodeURIComponent(league.id)}`

  const inviteMessageBody = league.isPrivate
    ? `Hey Racer! 🏁 You're invited to join our "${league.name}" karting league on KRAPP! Tap the link below to join the grid (League Password: ${effectivePassword}):`
    : `Hey Racer! 🏁 You're invited to join our "${league.name}" karting league on KRAPP! Tap the link below to join the grid:`

  const fullInviteText = `${inviteMessageBody}\n${inviteUrl}`

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(fullInviteText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2800)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = fullInviteText
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2800)
    }
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${league.name} on KRAPP`,
          text: inviteMessageBody,
          url: inviteUrl,
        })
        return
      } catch {
        // User cancelled or share failed; fall back to copy
      }
    }
    handleCopyInvite()
  }

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(fullInviteText)}`
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(inviteMessageBody)}`

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#1C2228] border-2 border-[#2A323B] rounded-3xl p-4 flex flex-col gap-3.5 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Pill Header: INVITE RACERS */}
        <div className="w-full bg-[#14191E] border border-[#2A323B] rounded-full h-11 px-4 flex items-center justify-between">
          <div className="w-6" />
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-[#FF6B00]" />
            <span className="font-display font-extrabold text-lg tracking-wider text-[#FF6B00] uppercase">
              INVITE RACERS
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close invite modal"
            className="w-7 h-7 rounded-full bg-[#1C2228] hover:bg-[#252D35] border border-[#2A323B] flex items-center justify-center text-[#8A99AD] hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inner Framed Card matching Wireframe */}
        <div className="w-full bg-[#14191E]/90 border-2 border-[#8A99AD]/40 rounded-3xl p-4 flex flex-col items-center text-center gap-3">
          {/* League Name + Access Badge */}
          <div className="flex flex-col items-center gap-1">
            <h2 className="font-display font-extrabold text-2xl tracking-wider text-[#FF6B00] uppercase leading-tight">
              {league.name}
            </h2>
            <div className="flex items-center gap-1.5">
              {league.isPrivate ? (
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#FF6B00]/15 border border-[#FF6B00]/40 text-[#FF6B00] flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Private League · Password:{' '}
                  <strong className="text-white font-mono">
                    {loadingPassword ? '...' : effectivePassword}
                  </strong>
                </span>
              ) : (
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#38BDF8]/15 border border-[#38BDF8]/40 text-[#38BDF8] flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Public League · Open Invite
                </span>
              )}
            </div>
          </div>

          {/* Scannable QR Code */}
          <div className="p-2.5 bg-white rounded-2xl shadow-xl border-2 border-[#FF6B00]">
            <QrCodeSvg value={inviteUrl} className="w-40 h-40" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A99AD] -mt-1">
            Scan QR code with camera to join instantly
          </span>

          {/* Invite Message Preview Box */}
          <div className="w-full bg-[#1C2228] border border-[#2A323B] rounded-2xl p-2.5 text-left flex flex-col gap-1">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#38BDF8]">
              Invite Message & Link:
            </span>
            <p className="text-[11px] text-white/90 leading-snug">
              "{inviteMessageBody}"
            </p>
            <span className="text-[11px] font-mono font-bold text-[#FF6B00] break-all leading-tight mt-0.5">
              {inviteUrl}
            </span>
          </div>

          {/* Primary COPY LINK Pill Button */}
          <button
            type="button"
            onClick={handleCopyInvite}
            className={`w-full rounded-full h-11 px-5 flex items-center justify-center gap-2 font-display font-extrabold text-base tracking-wider uppercase transition shadow-lg cursor-pointer ${
              copied
                ? 'bg-[#22C55E] text-black shadow-[#22C55E]/25'
                : 'bg-[#1C2228] hover:bg-[#252D35] border-2 border-[#FF6B00] text-[#FF6B00]'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>COPIED INVITE & LINK!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>COPY LINK</span>
              </>
            )}
          </button>

          {/* Direct Share Row: WhatsApp, Telegram, Share */}
          <div className="w-full grid grid-cols-3 gap-2 pt-0.5">
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 rounded-full bg-[#1C2228] hover:bg-[#252D35] border border-[#2A323B] hover:border-[#22C55E] text-[11px] font-display font-extrabold uppercase tracking-wider text-[#22C55E] flex items-center justify-center gap-1 transition"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>

            <a
              href={telegramShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 rounded-full bg-[#1C2228] hover:bg-[#252D35] border border-[#2A323B] hover:border-[#38BDF8] text-[11px] font-display font-extrabold uppercase tracking-wider text-[#38BDF8] flex items-center justify-center gap-1 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Telegram</span>
            </a>

            <button
              type="button"
              onClick={handleNativeShare}
              className="h-9 rounded-full bg-[#1C2228] hover:bg-[#252D35] border border-[#2A323B] hover:border-[#FF6B00] text-[11px] font-display font-extrabold uppercase tracking-wider text-white flex items-center justify-center gap-1 transition cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
