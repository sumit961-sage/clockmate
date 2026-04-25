// ClockMate Pro - Skeleton Card Loader
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-4">
      <div className="h-4 bg-slate-200 rounded w-3/4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3 bg-slate-200 rounded w-full" style={{ width: `${60 + Math.random() * 40}%` }} />
      ))}
      <div className="h-16 bg-slate-200 rounded" />
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="animate-pulse p-4">
      <div className="h-8 bg-slate-200 rounded w-1/2 mb-2" />
      <div className="h-3 bg-slate-200 rounded w-1/3" />
    </div>
  );
}

export function SkeletonAvatar() {
  return <div className="animate-pulse size-10 rounded-full bg-slate-200" />;
}
