import { createClient } from '@supabase/supabase-js'

export type LeagueRole = 'admin' | 'team_captain' | 'racer'

export interface League {
  id: string
  name: string
  country: string
  isPrivate: boolean
  password?: string
  createdByUserId: string
  memberRoles: Record<string, LeagueRole>
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

const ALL_LEAGUES_KEY = 'krapp_all_leagues_v2'
const MY_JOINED_IDS_KEY = 'krapp_joined_league_ids_v2'
const CURRENT_USER_ID_KEY = 'krapp_current_user_id_v1'

export function getCurrentUserId(): string {
  try {
    let id = localStorage.getItem(CURRENT_USER_ID_KEY)
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `driver-${Date.now()}`
      localStorage.setItem(CURRENT_USER_ID_KEY, id)
    }
    return id
  } catch {
    return 'local-driver'
  }
}

export function getLocalJoinedIds(): string[] {
  try {
    const raw = localStorage.getItem(MY_JOINED_IDS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveLocalJoinedIds(ids: string[]): void {
  try {
    localStorage.setItem(MY_JOINED_IDS_KEY, JSON.stringify(ids))
  } catch (e) {
    console.error('Failed to save joined league IDs', e)
  }
}

export function getLocalLeagues(): League[] {
  try {
    const raw = localStorage.getItem(ALL_LEAGUES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<League>[]
    return parsed.map((l) => ({
      id: l.id || 'unknown',
      name: l.name || 'LEAGUE',
      country: l.country || 'LATVIA',
      isPrivate: Boolean(l.isPrivate),
      password: l.password,
      createdByUserId: l.createdByUserId || '',
      memberRoles: l.memberRoles || {},
      createdAt: l.createdAt || new Date().toISOString(),
    }))
  } catch {
    return []
  }
}

export function saveLocalLeagues(leagues: League[]): void {
  try {
    localStorage.setItem(ALL_LEAGUES_KEY, JSON.stringify(leagues))
  } catch (e) {
    console.error('Failed to save local leagues', e)
  }
}

export function getUserRoleInLeague(league: League, userId: string): LeagueRole {
  if (league.createdByUserId === userId) {
    return 'admin'
  }
  return league.memberRoles?.[userId] || 'racer'
}

export async function fetchAllLeagues(): Promise<League[]> {
  try {
    const { data, error } = await supabase
      .from('leagues')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      const mapped: League[] = data.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        name: String(row.name || 'LEAGUE'),
        country: String(row.country || 'LATVIA'),
        isPrivate: Boolean(row.is_private),
        password: row.password ? String(row.password) : undefined,
        createdByUserId: String(row.created_by_user_id || ''),
        memberRoles: (row.member_roles as Record<string, LeagueRole>) || {},
        createdAt: String(row.created_at || new Date().toISOString()),
      }))
      saveLocalLeagues(mapped)
      return mapped
    }
    if (error) {
      console.warn('Supabase fetch warning (falling back to local cache):', error.message)
    }
  } catch (err) {
    console.warn('Supabase connection error:', err)
  }
  return getLocalLeagues()
}

export async function createNewLeague(input: {
  name: string
  country: string
  isPrivate: boolean
  password?: string
  creatorUserId: string
}): Promise<League> {
  const newLeague: League = {
    id: crypto.randomUUID ? crypto.randomUUID() : `league-${Date.now()}`,
    name: input.name.trim().toUpperCase(),
    country: input.country.trim().toUpperCase(),
    isPrivate: input.isPrivate,
    password: input.isPrivate ? input.password || '' : undefined,
    createdByUserId: input.creatorUserId,
    memberRoles: {
      [input.creatorUserId]: 'admin',
    },
    createdAt: new Date().toISOString(),
  }

  try {
    const { data, error } = await supabase
      .from('leagues')
      .insert([
        {
          name: newLeague.name,
          country: newLeague.country,
          is_private: newLeague.isPrivate,
          password: newLeague.password || null,
          created_by_user_id: newLeague.createdByUserId,
          member_roles: newLeague.memberRoles,
        },
      ])
      .select()
      .single()

    if (!error && data) {
      newLeague.id = String(data.id)
      newLeague.createdAt = String(data.created_at || newLeague.createdAt)
    } else if (error) {
      console.error('Supabase insert error:', error.message)
    }
  } catch (err) {
    console.error('Supabase insert exception:', err)
  }

  const current = getLocalLeagues()
  const updated = [newLeague, ...current]
  saveLocalLeagues(updated)

  return newLeague
}
