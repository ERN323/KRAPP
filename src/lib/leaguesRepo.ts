import { createClient } from '@supabase/supabase-js'
import { DriverProfile } from '../components/ProfileModal'

export type LeagueRole =
  | 'ADMIN'
  | 'CO-ADMIN'
  | 'TEAM CAPTAIN'
  | 'RACER'
  | 'RESERVIST'

export const ALL_LEAGUE_ROLES: LeagueRole[] = [
  'ADMIN',
  'CO-ADMIN',
  'TEAM CAPTAIN',
  'RACER',
  'RESERVIST',
]

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

export interface LeagueMemberItem {
  driverId: string
  displayName: string
  firstName: string
  surname: string
  handle: string
  driverNumber: string
  appRole: LeagueRole
  joinedAt: string
}

export interface AppNotification {
  id: string
  leagueId: string | null
  leagueName: string | null
  kind: string
  title: string
  body: string
  isRead: boolean
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

export function normalizeAppRole(raw?: string | null): LeagueRole {
  const upper = (raw || '').trim().toUpperCase()
  if (upper === 'ADMIN' || upper === 'OWNER') return 'ADMIN'
  if (upper === 'CO-ADMIN' || upper === 'ORGANISER') return 'CO-ADMIN'
  if (upper === 'TEAM CAPTAIN' || upper === 'TEAM_CAPTAIN') return 'TEAM CAPTAIN'
  if (upper === 'RESERVIST') return 'RESERVIST'
  return 'RACER'
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

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
) {
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
    driverNumber: String(data.driver_number || ''),
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
      driver_number: (profile.driverNumber || '').trim(),
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
    myRole: normalizeAppRole(row.my_role as string | null),
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
    myRole: 'ADMIN',
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

  return normalizeAppRole(String(data))
}

export async function fetchLeagueMembers(
  leagueId: string
): Promise<LeagueMemberItem[]> {
  const { data, error } = await supabase.rpc('fn_list_league_members', {
    p_league_id: leagueId,
  })

  if (error) {
    console.warn('Error fetching league members:', error.message)
    return []
  }

  if (!Array.isArray(data)) return []

  return data.map((row: Record<string, unknown>, idx: number) => ({
    driverId: String(row.driver_id),
    displayName: String(row.display_name || 'DRIVER'),
    firstName: String(row.first_name || ''),
    surname: String(row.surname || ''),
    handle: String(row.handle || '@driver'),
    driverNumber: String(row.driver_number || String(idx + 1)),
    appRole: normalizeAppRole(row.app_role as string | null),
    joinedAt: String(row.joined_at || new Date().toISOString()),
  }))
}

export async function assignLeagueMemberRole(
  leagueId: string,
  targetDriverId: string,
  newRole: LeagueRole
): Promise<void> {
  const { error } = await supabase.rpc('fn_assign_league_role', {
    p_league_id: leagueId,
    p_target_driver_id: targetDriverId,
    p_new_app_role: newRole,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function fetchMyNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase.rpc('fn_get_my_notifications')

  if (error) {
    console.warn('Error fetching notifications:', error.message)
    return []
  }

  if (!Array.isArray(data)) return []

  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    leagueId: row.league_id ? String(row.league_id) : null,
    leagueName: row.league_name ? String(row.league_name) : null,
    kind: String(row.kind || 'ROLE_CHANGE'),
    title: String(row.title || 'Notification'),
    body: String(row.body || ''),
    isRead: Boolean(row.is_read),
    createdAt: String(row.created_at || new Date().toISOString()),
  }))
}

export async function markAllNotificationsRead(): Promise<void> {
  await supabase.rpc('fn_mark_notifications_read')
}

export async function createLeagueTeamInSupabase(input: {
  leagueId: string
  name: string
  colorHex: string
  logoUrl: string | null
  driverIds: string[]
}): Promise<string> {
  const { data, error } = await supabase.rpc('fn_create_team', {
    p_league_id: input.leagueId,
    p_name: input.name.trim().toUpperCase(),
    p_color_hex: input.colorHex.trim() || '#FF6B00',
    p_logo_url: input.logoUrl,
    p_driver_ids: input.driverIds,
  })

  if (error) {
    throw new Error(error.message)
  }

  return String(data)
}

export interface LeagueTeamMember {
  driverId: string
  displayName: string
  firstName: string
  surname: string
  handle: string
  driverNumber: string
  appRole: LeagueRole
}

export interface LeagueTeam {
  id: string
  name: string
  colorHex: string
  logoUrl: string | null
  createdBy: string | null
  isMyTeam: boolean
  members: LeagueTeamMember[]
  createdAt: string
}

export async function fetchLeagueTeamsWithRosters(
  leagueId: string
): Promise<LeagueTeam[]> {
  const { data, error } = await supabase.rpc('fn_get_league_teams_with_rosters', {
    p_league_id: leagueId,
  })

  if (error) {
    console.warn('Error fetching league teams:', error.message)
    return []
  }

  if (!Array.isArray(data)) return []

  return data.map((row: Record<string, unknown>) => {
    const rawMembers = Array.isArray(row.members) ? row.members : []
    const members: LeagueTeamMember[] = rawMembers.map(
      (m: Record<string, unknown>, idx: number) => ({
        driverId: String(m.driver_id || ''),
        displayName: String(m.display_name || 'DRIVER'),
        firstName: String(m.first_name || ''),
        surname: String(m.surname || ''),
        handle: String(m.handle || '@driver'),
        driverNumber: String(m.driver_number || String(idx + 1)),
        appRole: normalizeAppRole(m.app_role as string | null),
      })
    )

    return {
      id: String(row.id),
      name: String(row.name || 'TEAM'),
      colorHex: String(row.color_hex || '#FF6B00'),
      logoUrl: row.logo_url ? String(row.logo_url) : null,
      createdBy: row.created_by ? String(row.created_by) : null,
      isMyTeam: Boolean(row.is_my_team),
      members,
      createdAt: String(row.created_at || new Date().toISOString()),
    }
  })
}

export async function updateLeagueTeamInSupabase(input: {
  teamId: string
  name: string
  colorHex: string
  logoUrl: string | null
  driverIds: string[]
}): Promise<void> {
  const { error } = await supabase.rpc('fn_update_team', {
    p_team_id: input.teamId,
    p_name: input.name.trim().toUpperCase(),
    p_color_hex: input.colorHex.trim() || '#FF6B00',
    p_logo_url: input.logoUrl,
    p_driver_ids: input.driverIds,
  })

  if (error) {
    throw new Error(error.message)
  }
}
