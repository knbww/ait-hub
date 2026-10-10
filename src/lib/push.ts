// Push notifications on this device: the browser subscription is registered with the database
// (register_push) and the Edge Function `push` sends through it. After an action the Hub asks
// the function to notify whoever it concerns; that call never blocks or fails the action.

import { supabase } from './supabase'
import { notConfigured } from './mutate'
import type { Result } from './mutate'

const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || null

export const pushSupported = () =>
  Boolean(vapidKey) && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const registration = await navigator.serviceWorker.getRegistration()
  return registration ? registration.pushManager.getSubscription() : null
}

export async function enablePush(): Promise<Result> {
  if (!supabase || !vapidKey) return notConfigured()
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { data: null, error: new Error('push_denied') }
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(vapidKey),
  })
  const json = subscription.toJSON()
  const { error } = await supabase.rpc('register_push', {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_user_agent: navigator.userAgent.slice(0, 300),
  })
  return { data: null, error }
}

export async function disablePush(): Promise<Result> {
  if (!supabase) return notConfigured()
  const subscription = await currentSubscription()
  if (!subscription) return { data: null, error: null }
  const { error } = await supabase.rpc('unregister_push', { p_endpoint: subscription.endpoint })
  await subscription.unsubscribe()
  return { data: null, error }
}

type Notice =
  | { action: 'review'; submission_id: string }
  | { action: 'news'; news_id: string }
  | { action: 'team_request'; request_id: string }

/** Fire and forget: tell the push function what just happened. */
export function notify(notice: Notice) {
  if (!supabase || !vapidKey) return
  void supabase.functions.invoke('push', { body: notice }).catch(() => {})
}
