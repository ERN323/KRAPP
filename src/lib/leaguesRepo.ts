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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

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
  if (supabase) {
    const { data, error } = await supabase
      .from('leagues')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      const mapped: League[] = data.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        name: String(row.name),
        country: String(row.country),
        isPrivate: Boolean(row.is_private),
        password: row.password ? String(row.password) : undefined,
        createdByUserId: String(row.created_by_user_id || ''),
        memberRoles: (row.member_roles as Record<string, LeagueRole>) || {},
        createdAt: String(row.created_at || new Date().toISOString()),
      }))
      saveLocalLeagues(mapped)
      return mapped
    }
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

  if (supabase) {
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
    }
  }

  const current = getLocalLeagues()
  const updated = [newLeague, ...current]
  saveLocalLeagues(updated)

  return newLeague
}
