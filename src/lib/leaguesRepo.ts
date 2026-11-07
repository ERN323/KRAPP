import { createClient } from '@supabase/supabase-js'
import { DriverProfile } from '../components/ProfileModal'

export type LeagueRole = 'admin' | 'team_captain' | 'racer'

export interface League {
  id: string
  name: string
  slug?: string
  country: string
  isPrivate: boolean
  isMember?: boolean
  myRole?: LeagueRole
  createdAt: string
}

// Connected directly to your KRAPP Supabase project
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  'https://skxossiiffqrfejvicyl.supabase.co'

const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'sb_publishable_T_lYXrPhPUy6I8OEAddLwg_yKQ_8l0j'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function mapDbRoleToAppRole(dbRole?: string | null): LeagueRole {
  if (dbRole === 'owner' || dbRole === 'admin') return 'admin'
  if (dbRole === 'organiser' || dbRole === 'team_captain') return 'team_captain'
  return 'racer'
}

export async function signInWithGoogle() {
  const redirectTo = window.location.origin + window.location.pathname
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  })
  if (error) throw error
  return data
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: displayName,
      },
    },
  })
  if (error) throw error
  return data
}

export async function signOutUser() {
  await supabase.auth.signOut()
}

export async function ensureAndLoadDriverProfile(userMeta?: {
  fullName?: string
  email?: string
  avatarUrl?: string
}): Promise<DriverProfile | null> {
  const preferredName =
    userMeta?.fullName ||
    (userMeta?.email ? userMeta.email.split('@')[0] : 'DRIVER')

  const { data, error } = await supabase.rpc('fn_ensure_current_driver', {
    p_display_name: preferredName,
    p_preferred_handle: preferredName,
  })

  if (error || !data) {
    console.warn('Could not load driver profile from RPC:', error?.message)
    return null
  }

  const cleanUsername = String(data.handle || '@USERNAME')
    .replace(/^@+/, '')
    .toUpperCase()

  return {
    username: cleanUsername,
    name: String(data.first_name || ''),
    surname: String(data.surname || ''),
    weightKg: data.weight_kg != null ? String(data.weight_kg) : '',
    bio: String(data.bio || ''),
    avatarType:
      data.avatar_type === 'custom' || data.avatar_type === 'helmet'
        ? data.avatar_type
        : userMeta?.avatarUrl
          ? 'custom'
          : 'helmet',
    helmetId: String(data.helmet_id || 'neon-viper'),
    customAvatarDataUrl: data.avatar_url || userMeta?.avatarUrl || null,
  }
}

export async function saveDriverProfileToSupabase(
  profile: DriverProfile
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const cleanHandleBase = profile.username
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-|-$/g, '')

  const validHandle =
    '@' + (cleanHandleBase.length >= 2 ? cleanHandleBase.slice(0, 38) : 'driver')

  const displayName =
    `${profile.name} ${profile.surname}`.trim() || profile.username.toUpperCase()

  const { error } = await supabase
    .from('drivers')
    .update({
      handle: validHandle,
      display_name: displayName,
      first_name: profile.name.trim(),
      surname: profile.surname.trim(),
      weight_kg: profile.weightKg ? parseFloat(profile.weightKg) : null,
      bio: profile.bio.trim(),
      avatar_type: profile.avatarType,
      helmet_id: profile.helmetId,
      avatar_url: profile.customAvatarDataUrl,
    })
    .eq('user_id', user.id)

  if (error) {
    console.warn('Failed to update driver row in Supabase:', error.message)
  }
}

export async function fetchAllLeagues(): Promise<League[]> {
  const { data, error } = await supabase.rpc('fn_list_leagues')

  if (error) {
    console.warn('Error fetching leagues via fn_list_leagues:', error.message)
    return []
  }

  if (!Array.isArray(data)) return []

  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name || 'LEAGUE'),
    slug: String(row.slug || ''),
    country: String(row.country || 'LATVIA'),
    isPrivate: Boolean(row.is_private),
    isMember: Boolean(row.is_member),
    myRole: mapDbRoleToAppRole(row.my_role as string | null),
    createdAt: String(row.created_at || new Date().toISOString()),
  }))
}

export async function createNewLeague(input: {
  name: string
  country: string
  isPrivate: boolean
  password?: string
}): Promise<League> {
  const { data, error } = await supabase.rpc('fn_create_league', {
    p_name: input.name.trim().toUpperCase(),
    p_country: input.country.trim().toUpperCase(),
    p_is_private: input.isPrivate,
    p_password: input.isPrivate ? input.password || '' : null,
  })

  if (error) {
    throw new Error(error.message)
  }

  const row = Array.isArray(data) ? data[0] : data
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug || ''),
    country: String(row.country),
    isPrivate: Boolean(row.is_private),
    isMember: true,
    myRole: 'admin',
    createdAt: String(row.created_at || new Date().toISOString()),
  }
}

export async function joinLeagueInSupabase(
  leagueId: string,
  password?: string
): Promise<LeagueRole> {
  const { data, error } = await supabase.rpc('fn_join_league', {
    p_league_id: leagueId,
    p_password: password || null,
  })

  if (error) {
    throw new Error(error.message)
  }

  return mapDbRoleToAppRole(String(data))
}
