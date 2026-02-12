/**
 * SkeletonLoader - Reusable skeleton loading components
 * Provides smooth loading experience instead of empty screens
 */
import React from "react";

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton element with pulse animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = "" }) => (
  <div
    className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded ${className}`}
  />
);

/**
 * Text line skeleton
 */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 1,
  className = "",
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={`h-4 ${i === lines - 1 ? "w-3/4" : "w-full"}`}
      />
    ))}
  </div>
);

/**
 * Card skeleton for grid layouts
 */
export const SkeletonCard: React.FC<SkeletonProps> = ({ className = "" }) => (
  <div
    className={`bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-700/40 p-5 ${className}`}
  >
    <div className="flex justify-between items-start mb-4">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-6 w-6 rounded-full" />
    </div>
    <Skeleton className="h-6 w-3/4 mb-2" />
    <SkeletonText lines={2} className="mb-4" />
    <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700/50">
      <Skeleton className="h-4 w-24" />
      <div className="flex gap-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  </div>
);

/**
 * Dashboard skeleton with stats and project cards
 */
export const DashboardSkeleton: React.FC = () => (
  <div className="p-6 space-y-6 animate-fadeIn">
    {/* Header */}
    <div className="flex justify-between items-center">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>

    {/* Stats Row */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-700/40 p-4"
        >
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>

    {/* Project Cards Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  </div>
);

/**
 * Pipeline/Kanban skeleton with columns
 */
export const PipelineSkeleton: React.FC = () => (
  <div className="flex flex-col h-full">
    {/* Header */}
    <div className="p-6 border-b border-slate-200 dark:border-slate-700/50">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
    </div>

    {/* Kanban Columns */}
    <div className="flex-1 overflow-x-auto p-6">
      <div className="flex gap-4 h-full min-w-max">
        {[1, 2, 3, 4, 5].map((col) => (
          <div
            key={col}
            className="w-80 flex-shrink-0 bg-slate-100 dark:bg-slate-950/30 rounded-2xl border border-slate-200 dark:border-slate-700/40"
          >
            {/* Column Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700/50">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
            </div>
            {/* Column Cards */}
            <div className="p-3 space-y-3">
              {Array.from({ length: Math.max(1, 4 - col) }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-900/80 rounded-xl p-4 border border-slate-200 dark:border-slate-700/40"
                >
                  <div className="flex justify-between items-start mb-3">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-16 rounded-lg" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3 w-3 rounded-full" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3 w-3 rounded-full" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/**
 * Category cards grid skeleton (Pipeline overview)
 */
export const CategoryGridSkeleton: React.FC = () => (
  <div className="p-6 space-y-6">
    {/* Header with filters */}
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-lg" />
          ))}
        </div>
      </div>
      <Skeleton className="h-10 w-40 rounded-lg" />
    </div>

    {/* Category Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  </div>
);

/**
 * Project layout skeleton with tabs
 */
export const ProjectLayoutSkeleton: React.FC = () => (
  <div className="flex flex-col h-full">
    {/* Project Header */}
    <div className="bg-white dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700/40 px-6 py-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <Skeleton className="h-7 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 w-28 rounded-lg" />
        ))}
      </div>
    </div>

    {/* Content Area */}
    <div className="flex-1 p-6">
      <CategoryGridSkeleton />
    </div>
  </div>
);

/**
 * Loading message with optional skeleton
 */
export const LoadingPlaceholder: React.FC<{
  message?: string;
  showSkeleton?: boolean;
  SkeletonComponent?: React.FC;
}> = ({ message = "Načítám...", showSkeleton = true, SkeletonComponent }) => {
  if (showSkeleton && SkeletonComponent) {
    return <SkeletonComponent />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-slate-500 dark:text-slate-400">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mb-4" />
      <p className="text-sm">{message}</p>
    </div>
  );
};

export default {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  DashboardSkeleton,
  PipelineSkeleton,
  CategoryGridSkeleton,
  ProjectLayoutSkeleton,
  LoadingPlaceholder,
};
