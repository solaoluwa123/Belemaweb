import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { CalendarIcon, Search, X, Filter } from "lucide-react";
import { format } from "date-fns";

export function FilterBar({
  searchPlaceholder = "Search...",
  filters = [],
  onApplyFilters = () => {},
  showInstitutionFilter = false,
  showStatusFilter = false,
  showSearchFilter = true,
  showDateRangeFilter = false,
  statusOptions = ["All", "Pending", "Approved", "Rejected"],
  institutions = [
    { id: "all", name: "All Institutions" },
    { id: "INST001", name: "Central Bank" },
    { id: "INST002", name: "Commercial Bank" },
    { id: "INST003", name: "Microfinance Bank" },
  ],
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [filterValues, setFilterValues] = useState({});
  const [searchTerm, setSearchTerm] = useState("");

  const [startDate, setStartDate] = useState();
  const [endDate, setEndDate] = useState();
  const [institutionId, setInstitutionId] = useState("all");
  const [status, setStatus] = useState("All");

  const hasActiveFilters =
    Object.keys(filterValues).some((k) => filterValues[k] !== undefined && filterValues[k] !== "") ||
    searchTerm ||
    startDate ||
    endDate ||
    institutionId !== "all" ||
    status !== "All";

  const handleApply = () => {
    if (filters.length > 0) {
      onApplyFilters({
        ...filterValues,
        searchTerm: searchTerm || undefined,
      });
    } else {
      onApplyFilters({
        startDate,
        endDate,
        institutionId: institutionId === "all" ? undefined : institutionId,
        status: status === "All" ? undefined : status,
        searchTerm: searchTerm || undefined,
      });
    }
    setModalOpen(false);
  };

  const handleClear = () => {
    setFilterValues({});
    setSearchTerm("");
    setStartDate(undefined);
    setEndDate(undefined);
    setInstitutionId("all");
    setStatus("All");
    onApplyFilters({});
    setModalOpen(false);
  };

  const handleFilterChange = (label, value) => {
    setFilterValues((prev) => ({
      ...prev,
      [label]: value,
    }));
  };

  const filterForm = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
      {filters.map((filter, index) => (
        <div key={index} className="space-y-2">
          <label className="text-sm font-medium text-gray-700">{filter.label}</label>
          {filter.type === "date" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filterValues[filter.label] ? format(filterValues[filter.label], "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filterValues[filter.label]}
                  onSelect={(date) => handleFilterChange(filter.label, date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )}
          {filter.type === "select" && filter.options && (
            <Select
              value={
                filterValues[filter.label] === undefined || filterValues[filter.label] === ""
                  ? "__all__"
                  : filterValues[filter.label]
              }
              onValueChange={(value) =>
                handleFilterChange(filter.label, value === "__all__" ? "" : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${filter.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {filter.options.map((option, optIndex) => {
                  const selectValue = option.value === "" ? "__all__" : option.value;
                  return (
                    <SelectItem
                      key={option.value === "" ? `all-${filter.label}-${optIndex}` : option.value}
                      value={selectValue}
                    >
                      {option.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>
      ))}

      {showDateRangeFilter && filters.length === 0 && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Start Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">End Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </>
      )}

      {showInstitutionFilter && filters.length === 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Institution</label>
          <Select value={institutionId} onValueChange={setInstitutionId}>
            <SelectTrigger>
              <SelectValue placeholder="Select institution" />
            </SelectTrigger>
            <SelectContent>
              {institutions.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>
                  {inst.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showStatusFilter && filters.length === 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showSearchFilter && (
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium text-gray-700">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}
    </div>
  );

  const hasAnyFilterControl =
    filters.length > 0 ||
    showDateRangeFilter ||
    showInstitutionFilter ||
    showStatusFilter ||
    showSearchFilter;

  if (!hasAnyFilterControl) {
    return null;
  }

  return (
    <>
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {hasActiveFilters ? "Filters applied" : "No filters applied"}
        </p>
        <Button onClick={() => setModalOpen(true)} variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
          Filters
        </Button>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          {filterForm}
          <DialogFooter>
            <Button variant="outline" onClick={handleClear} className="gap-2">
              <X className="w-4 h-4" />
              Clear
            </Button>
            <Button onClick={handleApply} className="gap-2">
              <Search className="w-4 h-4" />
              Apply Filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
