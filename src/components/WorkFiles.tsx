import { File, FileArchive, FileCode, FileImage, FileText, X } from 'lucide-react'
import { useI18n } from '../context/i18nContext'
import { fileExtension, formatFileSize, useWorkFileUrls } from '../lib/workFiles'
import type { WorkFile } from '../lib/db'

function FileIcon({ name }: { name: string }) {
  const ext = fileExtension(name)
  const className = 'w-4 h-4 shrink-0 text-gray-600'
  if (/^(png|jpe?g|webp|gif)$/.test(ext)) return <FileImage className={className} />
  if (ext === 'zip') return <FileArchive className={className} />
  if (/^(pdf|docx|odt|txt|md|pptx|odp|xlsx|ods|csv)$/.test(ext)) return <FileText className={className} />
  if (/^(ipynb|py|cpp|cc|c|h|hpp|java|kt|cs|go|rs|rb|php|js|jsx|ts|tsx|html|css|sql|sh|json)$/.test(ext)) {
    return <FileCode className={className} />
  }
  return <File className={className} />
}

const chipClass = 'inline-flex items-center gap-2 max-w-full rounded-xl border border-white/70 bg-white/50 px-3 py-2 text-sm'

/** Files handed in with a work, as links (signed, an hour). */
export function WorkFileList({ files }: { files: WorkFile[] }) {
  const { t } = useI18n()
  const { data: urls } = useWorkFileUrls(files)
  if (files.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2" aria-label={t('work.files')}>
      {files.map((f) => {
        const url = urls?.[f.path]
        return (
          <li key={f.path} className="max-w-full">
            <a href={url} target="_blank" rel="noreferrer" aria-disabled={!url}
              className={`${chipClass} hover:bg-white/80 transition-colors ${url ? '' : 'pointer-events-none opacity-60'}`}>
              <FileIcon name={f.name} />
              <span className="truncate">{f.name}</span>
              <span className="text-xs text-gray-600 shrink-0">{formatFileSize(f.size)}</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}

/** A chosen file in a form, before or after upload, with a remove button. */
export function WorkFileChip({ name, size, onRemove }: { name: string; size: number; onRemove: () => void }) {
  const { t } = useI18n()
  return (
    <span className={`${chipClass} pr-1.5`}>
      <FileIcon name={name} />
      <span className="truncate">{name}</span>
      <span className="text-xs text-gray-600 shrink-0">{formatFileSize(size)}</span>
      <button type="button" onClick={onRemove} aria-label={t('work.removeFile', { name })}
        className="p-1.5 -my-1 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-white/80">
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  )
}
