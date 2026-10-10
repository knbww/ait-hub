// Files handed in with a week's work: up to three, 5 MB each, in the member's folder of the
// private `works` bucket. Code and text go up as plain text, so a browser shows them instead
// of running them; anything that isn't a PDF or a picture downloads under its original name.

import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { WorkFile } from './db'

export const MAX_WORK_FILES = 3
export const MAX_WORK_FILE_BYTES = 5 * 1024 * 1024

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  zip: 'application/zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  odt: 'application/vnd.oasis.opendocument.text',
  odp: 'application/vnd.oasis.opendocument.presentation',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
}
const TEXT_EXTENSIONS = [
  'txt', 'md', 'csv', 'json', 'ipynb', 'py', 'cpp', 'cc', 'c', 'h', 'hpp', 'java', 'kt', 'cs', 'go', 'rs', 'rb',
  'php', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'sql', 'sh',
]
const INLINE = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif']

/** For the file picker's `accept`. */
export const WORK_FILE_ACCEPT = [...Object.keys(CONTENT_TYPES), ...TEXT_EXTENSIONS].map((e) => `.${e}`).join(',')

export const fileExtension = (name: string) => (/\.([A-Za-z0-9]{1,8})$/.exec(name)?.[1] ?? '').toLowerCase()

function contentType(ext: string): string | null {
  return CONTENT_TYPES[ext] ?? (TEXT_EXTENSIONS.includes(ext) ? 'text/plain' : null)
}

/** Throws `file_type` / `file_too_big` before anything is uploaded. */
export function checkWorkFile(file: File) {
  if (!contentType(fileExtension(file.name))) throw new Error('file_type')
  if (file.size > MAX_WORK_FILE_BYTES) throw new Error('file_too_big')
  if (file.size === 0) throw new Error('file_empty')
}

/** Uploads into the member's folder; on any failure removes what it already put there. */
export async function uploadWorkFiles(profileId: string, files: File[]): Promise<WorkFile[]> {
  if (!supabase || files.length === 0) return []
  const done: WorkFile[] = []
  for (const file of files) {
    const ext = fileExtension(file.name)
    const random = crypto.getRandomValues(new Uint32Array(2))
    const path = `${profileId}/${Date.now().toString(36)}-${random[0].toString(36)}${random[1].toString(36)}.${ext}`
    // Re-wrapped: for a File the browser's own type (text/x-python…) would win over contentType.
    const body = new Blob([file], { type: contentType(ext) ?? 'text/plain' })
    const { error } = await supabase.storage.from('works').upload(path, body, { upsert: false })
    if (error) {
      await removeWorkFiles(done.map((f) => f.path))
      throw error
    }
    done.push({ path, name: file.name.slice(0, 120), size: file.size })
  }
  return done
}

export async function removeWorkFiles(paths: string[]) {
  if (!supabase || paths.length === 0) return
  await supabase.storage.from('works').remove(paths)
}

/** Everything in a member's folder — when the director deletes the member's data. */
export async function clearWorkFolder(profileId: string) {
  if (!supabase) return
  const { data } = await supabase.storage.from('works').list(profileId, { limit: 1000 })
  await removeWorkFiles((data ?? []).map((f) => `${profileId}/${f.name}`))
}

export const opensInBrowser = (file: WorkFile) => INLINE.includes(fileExtension(file.path))

/** Signed links (an hour) by path; files that don't open in the browser download under their
 * original name. */
export function useWorkFileUrls(files: WorkFile[]) {
  const paths = files.map((f) => f.path)
  return useQuery<Record<string, string>>({
    queryKey: ['work-files', ...paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60_000,
    gcTime: 55 * 60_000,
    retry: false,
    queryFn: async () => {
      if (!supabase || paths.length === 0) return {}
      const { data, error } = await supabase.storage.from('works').createSignedUrls(paths, 3600)
      if (error) throw error
      const urls: Record<string, string> = {}
      for (const item of data) {
        const file = files.find((f) => f.path === item.path)
        if (!file || !item.signedUrl) continue
        urls[file.path] = opensInBrowser(file) ? item.signedUrl : `${item.signedUrl}&download=${encodeURIComponent(file.name)}`
      }
      return urls
    },
  })
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`
}
