import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('skeleton-shine rounded-lg bg-surface-2/80', className)}
      aria-hidden
    />
  )
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-hairline bg-surface/60 p-5', className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-8 w-20" />
      <Skeleton className="mt-4 h-2 w-full" />
    </div>
  )
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-hairline/60">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-1/4" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}
