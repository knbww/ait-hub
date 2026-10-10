// Plain text from the database with its web links made clickable. Only http(s) addresses become
// links; everything else stays text, so nothing typed into an assignment or a post can run.

const URL_PATTERN = /(https?:\/\/[^\s<>"«»]*[^\s<>"«».,;:!?)\]])/g
const LABEL_PATTERN = /^([А-ЯЁA-Z][^:\n]{0,40}):(\s)/

function Linked({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_PATTERN).map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noreferrer" className="underline break-all">{part}</a>
        ) : (
          part
        ),
      )}
    </>
  )
}

/** `labels` sets "Сдать:"-style line labels in bold — for structured texts like assignments. */
export function LinkifiedText({ text, labels = false, className = '' }: { text: string; labels?: boolean; className?: string }) {
  if (!labels) {
    return <p className={`whitespace-pre-wrap break-words ${className}`}><Linked text={text} /></p>
  }
  return (
    <div className={`space-y-1 break-words ${className}`}>
      {text.split('\n').map((line, i) => {
        const label = LABEL_PATTERN.exec(line)
        return (
          <p key={i}>
            {label ? (
              <>
                <span className="font-medium">{label[1]}:</span>
                {label[2]}
                <Linked text={line.slice(label[0].length)} />
              </>
            ) : (
              <Linked text={line} />
            )}
          </p>
        )
      })}
    </div>
  )
}
