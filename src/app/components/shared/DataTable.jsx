import { useState, useMemo, useCallback, isValidElement } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { formatEmptyCell } from "../../utils/formatters";

export function DataTable({
  data,
  columns,
  onRowClick,
  selectable = false,
  onSelectionChange,
  actions,
  isLoading = false,
  emptyMessage = "No data available",
  initialPageSize = 10,
}) {
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const handleSort = useCallback((columnKey) => {
    setSortColumn(prev => {
      if (prev === columnKey) {
        setSortDirection(d => d === "asc" ? "desc" : "asc");
        return prev;
      }
      setSortDirection("asc");
      return columnKey;
    });
  }, []);

  // Memoize sorted data to avoid re-sorting on every render
  const sortedData = useMemo(() => {
    if (!sortColumn) return [...data];
    
    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      if (aVal === bVal) return 0;
      
      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = aVal < bVal ? -1 : 1;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection]);

  const getRowKey = useCallback(
    (row) => {
      if (row.id != null && row.id !== "") return String(row.id);
      const i = sortedData.indexOf(row);
      return i >= 0 ? `row-${i}` : "row-unknown";
    },
    [sortedData],
  );

  const handleSelectAll = useCallback(() => {
    const allKeys = data.map((row) => getRowKey(row));
    const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedRows.has(k));
    if (allSelected) {
      setSelectedRows(new Set());
      onSelectionChange?.([]);
    } else {
      setSelectedRows(new Set(allKeys));
      onSelectionChange?.(data);
    }
  }, [data, selectedRows, onSelectionChange, getRowKey]);

  const handleSelectRow = useCallback(
    (row) => {
      const key = getRowKey(row);
      setSelectedRows((prev) => {
        const newSelected = new Set(prev);
        if (newSelected.has(key)) {
          newSelected.delete(key);
        } else {
          newSelected.add(key);
        }
        onSelectionChange?.(data.filter((r) => newSelected.has(getRowKey(r))));
        return newSelected;
      });
    },
    [data, onSelectionChange, getRowKey],
  );

  // Memoize paginated data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handlePageSizeChange = useCallback((value) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  }, []);

  const getSortIcon = (columnKey) => {
    if (sortColumn !== columnKey) return <ArrowUpDown className="w-4 h-4 opacity-50" />;
    return sortDirection === "asc" ? 
      <ArrowUp className="w-4 h-4" /> : 
      <ArrowDown className="w-4 h-4" />;
  };

  const showInitialLoading = isLoading && data.length === 0;

  if (showInitialLoading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border bg-white">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={data.length > 0 && data.every((row) => selectedRows.has(getRowKey(row)))}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all rows"
                  />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead key={column.key} className="whitespace-nowrap">
                  {column.sortable ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleSort(column.key)}
                      className="mx-auto flex h-auto items-center justify-center gap-1 p-0 text-center font-medium whitespace-nowrap hover:bg-transparent"
                      aria-label={`Sort by ${column.label}`}
                    >
                      {column.label}
                      {getSortIcon(column.key)}
                    </Button>
                  ) : (
                    <span className="font-medium whitespace-nowrap">{column.label}</span>
                  )}
                </TableHead>
              ))}
              {actions && <TableHead className="whitespace-nowrap">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}
                  className="text-center py-8 text-gray-500"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
                paginatedData.map((row) => {
                const rowKey = getRowKey(row);
                return (
                <TableRow
                  key={rowKey}
                  className={`${onRowClick ? "cursor-pointer hover:bg-gray-50" : ""}`}
                  onClick={() => onRowClick?.(row)}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  }}
                >
                  {selectable && (
                    <TableCell className="w-12 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedRows.has(rowKey)}
                        onCheckedChange={() => handleSelectRow(row)}
                        aria-label={`Select row ${rowKey}`}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.cellClassName}>
                      {(() => {
                        const rendered = column.render
                          ? column.render((row)[column.key], row)
                          : (row)[column.key];
                        if (isValidElement(rendered)) return rendered;
                        return formatEmptyCell(rendered);
                      })()}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {actions(row)}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">Rows per page:</span>
          <Select
            value={pageSize.toString()}
            onValueChange={handlePageSizeChange}
          >
            <SelectTrigger className="w-20" aria-label="Select page size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages || 1} ({sortedData.length} total)
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(p => p - 1)}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}