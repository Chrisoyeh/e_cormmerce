import React from 'react';

interface SkeletonProps {
  className?: string;
}

/** Single shimmer bar */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse ${className}`} />
  );
}

/** Skeleton for a KPI overview tile */
export function SkeletonCard() {
  return (
    <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-2 w-16" />
    </div>
  );
}

/** Skeleton for a table row */
export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className={`h-3 ${i === 0 ? 'w-6' : i === cols - 1 ? 'w-16' : 'w-full'}`} />
        </td>
      ))}
    </tr>
  );
}

/** Skeleton for a pupil/book list card */
export function SkeletonListCard() {
  return (
    <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl">
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2 w-20" />
      </div>
      <Skeleton className="h-6 w-16 rounded-lg" />
    </div>
  );
}

/** 5-row table skeleton */
export function SkeletonTable({ cols = 6, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </>
  );
}

/** Grid of list card skeletons */
export function SkeletonList({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonListCard key={i} />
      ))}
    </div>
  );
}
