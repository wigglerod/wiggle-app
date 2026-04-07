export default function BeastMessage({ role, content }) {
  const isUser = role === 'user'

  return (
    <div
      className="flex mb-3"
      style={{ justifyContent: isUser ? 'flex-end' : 'flex-start' }}
    >
      <div
        style={{
          maxWidth: isUser ? '75%' : '85%',
          background: isUser ? 'var(--tower-plateau-blue-light)' : 'var(--tower-orange-light)',
          border: `1px solid ${isUser ? 'var(--tower-plateau-blue)' : 'var(--tower-orange)'}`,
          borderRadius: isUser ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
          padding: '8px 12px',
          fontSize: 'var(--tower-text-base)',
          color: 'var(--tower-text-primary)',
          fontFamily: 'var(--tower-font)',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
        }}
      >
        {content}
      </div>
    </div>
  )
}
