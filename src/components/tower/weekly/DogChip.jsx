export default function DogChip({ dogName }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--tower-bg-surface-alt)',
        border: '1px solid var(--tower-border-default)',
        borderRadius: 20,
        padding: '2px 8px',
        fontSize: 'var(--tower-text-sm)',
        color: 'var(--tower-purple)',
        margin: 2,
        maxWidth: 140,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontFamily: 'var(--tower-font)',
        fontWeight: 'var(--tower-font-medium)',
      }}
    >
      {dogName}
    </span>
  )
}
