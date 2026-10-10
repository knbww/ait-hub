import { supabase } from './supabase'
import { notConfigured, refresh } from './mutate'
import { notify } from './push'
import { queryClient } from './queryClient'
import { photoName } from './images'
import type { Result } from './mutate'
import type { ShrunkPhoto } from './images'
import type { NewsRow, TrackId } from './db'

export interface NewsInput {
  title: string
  body: string
  link_url: string | null
  track_id: TrackId | null
  pinned: boolean
  allow_comments: boolean
}

export interface NewsPhotos {
  /** Photos already on the post that stay, in order. */
  keep: string[]
  /** New photos, already shrunk; they go after the kept ones. */
  add: ShrunkPhoto[]
}

/** Text first (a new post needs its id for the photo folder), then the new photos, then the
 * list on the post; photos taken off the post are deleted last. */
export async function saveNews(post: NewsRow | null, input: NewsInput, photos: NewsPhotos): Promise<Result> {
  if (!supabase) return notConfigured()
  let id = post?.id ?? null
  if (id) {
    const { error } = await supabase.from('news').update(input).eq('id', id)
    if (error) return { data: null, error }
  } else {
    const { data, error } = await supabase.from('news').insert(input).select('id').single()
    if (error) return { data: null, error }
    id = (data as { id: string }).id
  }

  const uploaded: string[] = []
  for (const photo of photos.add) {
    const path = `${id}/${photoName(photo.ext)}`
    const { error } = await supabase.storage.from('news')
      .upload(path, photo.blob, { contentType: photo.blob.type, cacheControl: '31536000', upsert: false })
    if (error) {
      await refresh([['news']])
      return { data: null, error }
    }
    uploaded.push(path)
  }

  const next = [...photos.keep, ...uploaded]
  const before = post?.photos ?? []
  if (next.join('|') !== before.join('|')) {
    const { error } = await supabase.from('news').update({ photos: next }).eq('id', id)
    if (error) {
      await refresh([['news']])
      return { data: null, error }
    }
    const removed = before.filter((p) => !next.includes(p))
    if (removed.length) await supabase.storage.from('news').remove(removed)
  }

  if (!post) notify({ action: 'news', news_id: id })
  await refresh([['news']])
  return { data: null, error: null }
}

export async function deleteNews(post: NewsRow): Promise<Result> {
  if (!supabase) return notConfigured()
  if (post.photos.length) {
    const { error } = await supabase.storage.from('news').remove(post.photos)
    if (error) return { data: null, error }
  }
  const { error } = await supabase.from('news').delete().eq('id', post.id)
  if (error) return { data: null, error }
  await refresh([['news']])
  return { data: null, error: null }
}

/** Like or unlike, shown at once; the list is re-read if the database says no. */
export async function setLike(post: NewsRow, me: { id: string; full_name: string }, liked: boolean): Promise<Result> {
  if (!supabase) return notConfigured()
  queryClient.setQueryData<NewsRow[]>(['news'], (list) =>
    list?.map((n) => {
      if (n.id !== post.id) return n
      const others = (n.likes ?? []).filter((l) => l.profile_id !== me.id)
      return { ...n, likes: liked ? [...others, { profile_id: me.id, profile: { full_name: me.full_name } }] : others }
    }),
  )
  const { error } = liked
    ? await supabase.from('news_likes').insert({ news_id: post.id, profile_id: me.id })
    : await supabase.from('news_likes').delete().eq('news_id', post.id).eq('profile_id', me.id)
  // A double tap may try to like twice: the like is there, which is what was asked.
  if (error && !(liked && (error as { code?: string }).code === '23505')) {
    await refresh([['news']])
    return { data: null, error }
  }
  return { data: null, error: null }
}

export async function addComment(newsId: string, body: string): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase.from('news_comments').insert({ news_id: newsId, body })
  if (error) return { data: null, error }
  await refresh([['news-comments', newsId], ['news']])
  return { data: null, error: null }
}

export async function deleteComment(newsId: string, commentId: string): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase.from('news_comments').delete().eq('id', commentId)
  if (error) return { data: null, error }
  await refresh([['news-comments', newsId], ['news']])
  return { data: null, error: null }
}
