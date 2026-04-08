export type ClosetItem = {
  id: string
  category: string
  brand: string | null
  color: string | null
  created_at: string
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.5rem',
  padding: '0.5rem 0',
  borderBottom: '1px solid #e5e5e5',
}

export function ClosetList({ items }: { items: ClosetItem[] }) {
  if (items.length === 0) {
    return <p style={{ color: 'gray' }}>No items yet — add one above.</p>
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {items.map((item) => (
        <li key={item.id} style={rowStyle}>
          <span style={{
            background: '#e8f0fe',
            borderRadius: '4px',
            padding: '0.1rem 0.4rem',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}>
            {item.category}
          </span>
          <span>{item.brand ?? <em style={{ color: 'gray' }}>Unnamed</em>}</span>
          {item.color && (
            <span style={{ color: 'gray', fontSize: '0.8rem' }}>· {item.color}</span>
          )}
        </li>
      ))}
    </ul>
  )
}
