'use client';

import { useState, useEffect, useCallback } from 'react';
import getFilteredRecords from '@/app/actions/getFilteredRecords';
import deleteRecord from '@/app/actions/deleteRecord';
import { Record } from '@/types/Record';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterIcon, X, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

// Currency formatter for Bolivianos
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("es-BO", { 
    style: "currency", 
    currency: "BOB" 
  }).format(amount);
};

// Date formatter
const formatDate = (date: string | number | Date): string => {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

// Filter interface
interface FilterState {
  category: string;
  minAmount: string;
  maxAmount: string;
  startDate: string;
  endDate: string;
}

// Sort interface
interface SortState {
  field: 'date' | 'text' | 'category' | 'amount' | null;
  direction: 'asc' | 'desc';
}

// Delete action component
const DeleteButton = ({ recordId, onDelete }: { recordId: string; onDelete: () => void }) => {
  const handleDelete = async () => {
    try {
      const result = await deleteRecord(recordId);
      if (result.error) {
        console.error('Delete error:', result.error);
      } else {
        onDelete(); // Refresh the records
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  return (
    <Button
      onClick={handleDelete}
      variant="destructive"
      size="sm"
      className="h-8 px-2 text-xs"
    >
      Delete
    </Button>
  );
};

// Filter component
const FilterHeader = ({ 
  filters, 
  onFilterChange, 
  onClearFilters 
}: { 
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: string) => void;
  onClearFilters: () => void;
}) => {
  const categories = [
    'Food',
    'Transportation', 
    'Entertainment',
    'Shopping',
    'Bills',
    'Healthcare',
    'Other'
  ];

  const hasActiveFilters = Object.values(filters).some(value => value !== '');

  return (
    <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <FilterIcon className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
      </div>
      
      {/* Category Filter */}
      <Select value={filters.category} onValueChange={(value) => onFilterChange('category', value)}>
        <SelectTrigger className="w-[140px] h-8">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Amount Range Filter */}
      <div className="flex items-center gap-1">
        <Input
          type="number"
          placeholder="Min"
          value={filters.minAmount}
          onChange={(e) => onFilterChange('minAmount', e.target.value)}
          className="w-20 h-8 text-xs"
        />
        <span className="text-xs text-gray-500">-</span>
        <Input
          type="number"
          placeholder="Max"
          value={filters.maxAmount}
          onChange={(e) => onFilterChange('maxAmount', e.target.value)}
          className="w-20 h-8 text-xs"
        />
        <span className="text-xs text-gray-500">Bs</span>
      </div>

      {/* Date Range Filter */}
      <div className="flex items-center gap-1">
        <Input
          type="date"
          value={filters.startDate}
          onChange={(e) => onFilterChange('startDate', e.target.value)}
          className="w-32 h-8 text-xs"
        />
        <span className="text-xs text-gray-500">to</span>
        <Input
          type="date"
          value={filters.endDate}
          onChange={(e) => onFilterChange('endDate', e.target.value)}
          className="w-32 h-8 text-xs"
        />
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          className="h-8 px-2 text-xs"
        >
          <X className="h-3 w-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
};

const RecordHistory = () => {
  const [records, setRecords] = useState<Record[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    category: 'all',
    minAmount: '',
    maxAmount: '',
    startDate: '',
    endDate: '',
  });
  const [sort, setSort] = useState<SortState>({
    field: 'date',
    direction: 'desc',
  });

  const loadRecords = useCallback(async (filterState: FilterState = filters, sortState: SortState = sort) => {
    setLoading(true);
    try {
      const filterOptions = {
        category: filterState.category !== 'all' ? filterState.category : undefined,
        minAmount: filterState.minAmount ? parseFloat(filterState.minAmount) : undefined,
        maxAmount: filterState.maxAmount ? parseFloat(filterState.maxAmount) : undefined,
        startDate: filterState.startDate || undefined,
        endDate: filterState.endDate || undefined,
        sortField: sortState.field || 'date',
        sortDirection: sortState.direction || 'desc',
      };

      const { records: fetchedRecords, error: fetchError } = await getFilteredRecords(filterOptions);
      
      if (fetchError) {
        setError(fetchError);
      } else {
        setRecords(fetchedRecords || []);
        setError(null);
      }
    } catch (error) {
      console.error('Error loading records:', error);
      setError('Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [filters, sort]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Listen for record added events
  useEffect(() => {
    const handleRecordAdded = () => {
      loadRecords();
    };

    window.addEventListener('recordAdded', handleRecordAdded);
    
    return () => {
      window.removeEventListener('recordAdded', handleRecordAdded);
    };
  }, [loadRecords]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    loadRecords(newFilters, sort);
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      category: 'all',
      minAmount: '',
      maxAmount: '',
      startDate: '',
      endDate: '',
    };
    setFilters(clearedFilters);
    loadRecords(clearedFilters, sort);
  };

  const handleSort = (field: 'date' | 'text' | 'category' | 'amount') => {
    let newDirection: 'asc' | 'desc' = 'asc';
    
    if (sort.field === field && sort.direction === 'asc') {
      newDirection = 'desc';
    } else if (sort.field === field && sort.direction === 'desc') {
      newDirection = 'asc';
    }
    
    const newSort = { field, direction: newDirection };
    setSort(newSort);
    loadRecords(filters, newSort);
  };

  // Sortable header component
  const SortableHeader = ({ 
    field, 
    children, 
    className = "" 
  }: { 
    field: 'date' | 'text' | 'category' | 'amount';
    children: React.ReactNode;
    className?: string;
  }) => {
    const getSortIcon = () => {
      if (sort.field !== field) {
        return <ArrowUpDown className="h-3 w-3 opacity-50" />;
      }
      return sort.direction === 'asc' 
        ? <ArrowUp className="h-3 w-3" />
        : <ArrowDown className="h-3 w-3" />;
    };

    return (
      <TableHead 
        className={`font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          {children}
          {getSortIcon()}
        </div>
      </TableHead>
    );
  };

  if (error) {
    return (
      <div className='bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-4 sm:p-6 rounded-2xl shadow-xl border border-gray-100/50 dark:border-gray-700/50'>
        <div className='flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6'>
          <div className='w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg'>
            <span className='text-white text-sm sm:text-lg'>📝</span>
          </div>
          <div>
            <h3 className='text-lg sm:text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent'>
              Expense History
            </h3>
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-0.5'>
              Your spending timeline
            </p>
          </div>
        </div>
        <div className='bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-l-4 border-l-red-500 p-3 sm:p-4 rounded-xl'>
          <div className='flex items-center gap-2 mb-2'>
            <div className='w-6 h-6 sm:w-8 sm:h-8 bg-red-100 dark:bg-red-800 rounded-lg flex items-center justify-center'>
              <span className='text-base sm:text-lg'>⚠️</span>
            </div>
            <h4 className='font-bold text-red-800 dark:text-red-300 text-sm'>
              Error loading expense history
            </h4>
          </div>
          <p className='text-red-700 dark:text-red-400 ml-8 sm:ml-10 text-xs'>
            {error}
          </p>
        </div>
      </div>
    );
  }

    return (
    <div className='bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-4 sm:p-6 rounded-2xl shadow-xl border border-gray-100/50 dark:border-gray-700/50 hover:shadow-2xl'>
      <div className='flex items-center justify-between mb-4 sm:mb-6'>
        <div className='flex items-center gap-2 sm:gap-3'>
          <div className='w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg'>
            <span className='text-white text-sm sm:text-lg'>📝</span>
          </div>
          <div>
            <h3 className='text-lg sm:text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent'>
              Expense History
            </h3>
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-0.5'>
              Your spending timeline
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadRecords()}
          disabled={loading}
          className="h-8 px-3 text-xs"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
          </div>
      
      {/* Filter Header */}
      <FilterHeader 
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />
      
      <div className="rounded-md border border-gray-200 dark:border-gray-700 shadow-sm">
        <Table>
          <TableHeader className="sticky top-0 bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
            <TableRow className="hover:bg-transparent">
              <SortableHeader field="date">Date</SortableHeader>
              <SortableHeader field="text">Description</SortableHeader>
              <SortableHeader field="category">Category</SortableHeader>
              <SortableHeader field="amount" className="text-right">Amount</SortableHeader>
              <TableHead className="font-semibold text-gray-900 dark:text-gray-100 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                      Loading expenses...
          </p>
        </div>
                </TableCell>
              </TableRow>
            ) : records && records.length > 0 ? (
              records.map((record: Record) => (
                <TableRow 
                  key={record.id} 
                  className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                    {formatDate(record.date)}
                  </TableCell>
                  <TableCell className="text-gray-700 dark:text-gray-300">
                    {record.text}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {record.category}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(record.amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    <DeleteButton recordId={record.id} onDelete={() => loadRecords()} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      <span className="text-xl">📊</span>
      </div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                      No expenses found
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      {Object.values(filters).some(value => value !== '' && value !== 'all') 
                        ? 'Try adjusting your filters or add new expenses'
                        : 'Start tracking your expenses to see them here'
                      }
          </p>
        </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {(!records || records.length === 0) && !loading && (
            <TableCaption className="text-gray-500 dark:text-gray-400">
              {Object.values(filters).some(value => value !== '' && value !== 'all') 
                ? 'No expenses match your current filters. Try adjusting the filter criteria.'
                : 'No expenses found. Add your first expense to get started.'
              }
            </TableCaption>
          )}
        </Table>
      </div>
    </div>
  );
};

export default RecordHistory;
