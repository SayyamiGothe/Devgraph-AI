const ITEMS = [
  'PDF',
  'DOCX',
  'Confluence',
  'Notion',
  'Jira',
  'Markdown',
  'Google Docs',
  'Slack threads',
  'Figma specs',
  'S3 buckets',
  'GitHub wikis',
  'Scanned contracts',
]

/**
 * Infinite source-type strip. The track holds the list twice and translates by
 * -50%, so the loop point is invisible.
 */
export function Marquee() {
  return (
    <div className="marquee" aria-label="Supported sources">
      <div className="marquee__track">
        {[0, 1].map((copy) => (
          <div className="marquee__group" key={copy} aria-hidden={copy === 1}>
            {ITEMS.map((item) => (
              <span className="marquee__item" key={item}>
                <i aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
