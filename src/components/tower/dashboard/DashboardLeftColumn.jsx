import WalkerFlagsPanel from './WalkerFlagsPanel'

export default function DashboardLeftColumn({ walkerFlags, walkerFlagsLoading, walkerFlagsError, onResolveFlag }) {
  return (
    <div>
      <WalkerFlagsPanel
        walkerFlags={walkerFlags}
        loading={walkerFlagsLoading}
        error={walkerFlagsError}
        onResolve={onResolveFlag}
      />
    </div>
  )
}
