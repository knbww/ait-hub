import { useAvatarUrl } from '../hooks/useManage'
import { initials } from '../lib/club'

const SIZES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-16 h-16 text-lg',
}

/** A member's photo (private bucket, signed URL) or their initials. `path` is already null
 * for members who said no to photos — the database clears it. */
export function Avatar({ path, name, size = 'md' }: { path: string | null | undefined; name: string; size?: keyof typeof SIZES }) {
  const { data: url } = useAvatarUrl(path)
  return (
    <div
      className={`${SIZES[size]} shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 text-gray-600 flex items-center justify-center font-medium`}
      aria-hidden="true"
    >
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : initials(name)}
    </div>
  )
}
