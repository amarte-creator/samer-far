'use server';
import { db } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';
import { Record as ExpenseRecord } from '@/types/Record';

interface FilterOptions {
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
  sortField?: 'date' | 'text' | 'category' | 'amount';
  sortDirection?: 'asc' | 'desc';
}

async function getFilteredRecords(filters: FilterOptions = {}): Promise<{
  records?: ExpenseRecord[];
  error?: string;
}> {
  const { userId } = await auth();

  if (!userId) {
    return { error: 'User not found' };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = { userId };

    // Add category filter
    if (filters.category && filters.category !== 'all') {
      whereClause.category = filters.category;
    }

    // Add amount range filter
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      whereClause.amount = {};
      if (filters.minAmount !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (whereClause.amount as any).gte = filters.minAmount;
      }
      if (filters.maxAmount !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (whereClause.amount as any).lte = filters.maxAmount;
      }
    }

    // Add date range filter
    if (filters.startDate || filters.endDate) {
      whereClause.date = {};
      if (filters.startDate) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (whereClause.date as any).gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (whereClause.date as any).lte = new Date(filters.endDate);
      }
    }

    // Build orderBy clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderBy: any = {};
    const sortField = filters.sortField || 'date';
    const sortDirection = filters.sortDirection || 'desc';
    
    orderBy[sortField] = sortDirection;

    const records = await db.record.findMany({
      where: whereClause,
      orderBy,
      take: 50, // Increased limit for filtered results
    });

    return { records };
  } catch (error) {
    console.error('Error fetching filtered records:', error);
    return { error: 'Database error' };
  }
}

export default getFilteredRecords;
