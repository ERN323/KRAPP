import React, { useState } from 'react'
import { Mail, Lock, User, AlertCircle } from 'lucide-react'
import { KrappLogoHelmet } from './HelmetIcons'
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
} from '../lib/leaguesRepo'

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setErrorMsg('')
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to start Google Sign-In'
      )
      setLoading(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setInfoMsg('')

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password)
      } else {
        const res = await signUpWithEmail(
          email.trim(),
          password,
          displayName.trim() || email.split('@')[0]
        )
        if (res.user && !res.session) {
          setInfoMsg(
            'Account created! Check your email inbox to confirm, or sign in if confirmation is disabled.'
          )
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#0d1114] text-white flex justify-center">
      <main className="w-full max-w-md min-h-screen bg-[#14191E] border-x border-[#222A32] flex flex-col justify-between p-6 select-none shadow-2xl">
        {/* Top Brand Header */}
        <div className="pt-6 flex flex-col items-center text-center">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-14 h-14 rounded-2xl bg-[#0B0D10] border border-[#FF6B00]/50 flex items-center justify-center p-1 shadow-lg shadow-[#FF6B00]/15">
              <KrappLogoHelmet className="w-12 h-12" />
            </div>
            <span className="font-display italic font-extrabold text-5xl tracking-wider text-white">
              KRAPP
            </span>
          </div>
          <span className="text-[11px] font-bold tracking-[0.2em] text-[#FF6B00] uppercase">
            KARTING RACING APP · TRACK DAY PRO
          </span>
        </div>

        {/* Auth Card */}
        <div className="my-auto bg-[#1C2228] border border-[#2A323B] rounded-2xl p-6 shadow-xl">
          <h1 className="font-display font-extrabold text-2xl tracking-wide text-white uppercase text-center mb-1">
            DRIVER <span className="text-[#FF6B00]">PADDOCK LOGIN</span>
          </h1>
          <p className="text-xs text-[#8A99AD] text-center mb-6">
            Sign in so your leagues, roles & race results sync across all your devices
          </p>

          {/* Primary Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white hover:bg-neutral-100 active:scale-[0.99] transition-all rounded-full h-12 px-5 flex items-center justify-center gap-3 shadow-lg cursor-pointer disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="font-display font-extrabold text-base tracking-wider text-black uppercase">
              CONTINUE WITH GOOGLE
            </span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="h-px bg-[#2A323B] flex-1" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#8A99AD]">
              OR USE EMAIL
            </span>
            <div className="h-px bg-[#2A323B] flex-1" />
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <div className="relative">
                <User className="w-4 h-4 text-[#FF6B00] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Driver Name (e.g. Ernests)"
                  className="w-full bg-[#14191E] border border-[#2A323B] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF6B00]"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="w-4 h-4 text-[#8A99AD] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full bg-[#14191E] border border-[#2A323B] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF6B00]"
              />
            </div>

            <div className="relative">
              <Lock className="w-4 h-4 text-[#8A99AD] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-[#14191E] border border-[#2A323B] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF6B00]"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl p-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div className="text-xs text-[#38BDF8] bg-[#38BDF8]/10 border border-[#38BDF8]/30 rounded-xl p-2.5">
                {infoMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FF6B00] hover:bg-[#ff7b1a] active:scale-[0.99] transition-all rounded-full h-11 px-5 flex items-center justify-center shadow-lg shadow-[#FF6B00]/20 cursor-pointer disabled:opacity-50"
            >
              <span className="font-display font-extrabold text-base tracking-wider text-black uppercase">
                {loading
                  ? 'PLEASE WAIT...'
                  : mode === 'signin'
                    ? 'SIGN IN WITH EMAIL'
                    : 'CREATE DRIVER ACCOUNT'}
              </span>
            </button>
          </form>

          {/* Toggle Sign-In / Sign-Up */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setErrorMsg('')
                setInfoMsg('')
              }}
              className="text-xs text-[#8A99AD] hover:text-white underline cursor-pointer"
            >
              {mode === 'signin'
                ? "Don't have an account yet? Create one"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-[#8A99AD] text-center uppercase tracking-wider">
          Powered by Supabase · SpeedHive Compatible
        </p>
      </main>
    </div>
  )
}
