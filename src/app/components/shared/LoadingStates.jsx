import { Skeleton } from '../ui/skeleton';

/**
 * Skeleton loading state for DataTable
 * Shows a shimmer effect while data is loading
 */
export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                {Array.from({ length: columns }).map((_, i) => (
                  <th key={i} className="p-4 text-center">
                    <Skeleton className="h-4 w-24" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b">
                  {Array.from({ length: columns }).map((_, colIndex) => (
                    <td key={colIndex} className="p-4">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Pagination skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton loading state for MetricCard components
 */
export function MetricSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[color:var(--border)] bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton loading state for charts
 */
export function ChartSkeleton({ height = 'h-64' }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <Skeleton className="h-6 w-40 mb-4" />
      <Skeleton className={`w-full ${height}`} />
    </div>
  );
}
