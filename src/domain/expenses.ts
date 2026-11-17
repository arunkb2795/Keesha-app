export const categoryNames = {
  food: 'Food & Drinks',
  grocery: 'Groceries',
  transport: 'Transport',
  shopping: 'Shopping',
  bills: 'Bills',
  medical: 'Health',
  entertainment: 'Entertainment',
  travel: 'Travel',
  education: 'Education',
  other: 'Other',
} as const;

export type CategoryId = keyof typeof categoryNames;
export type ExpensePeriod = { kind: 'day' | 'month'; date: string };
export const categoryIds = Object.keys(categoryNames) as CategoryId[];

export const maxExpensePaise = 999_999_999;
export const maxExpenseTextLength = 200;
export const accountTimezone = 'Asia/Kolkata';

const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' });
const ordinalSuffixes = ['th', 'st', 'nd', 'rd'] as const;

export function formatExpenseDate(date: Date) {
  const day = date.getDate();
  const suffix = day >= 11 && day <= 13 ? 'th' : (ordinalSuffixes[day % 10] ?? 'th');
  return `${monthName.format(date)} ${day}${suffix}, ${date.getFullYear()}`;
}

export function expenseDateKey(date: Date) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseExpensePaise(value: string) {
  const input = value.trim();
  if (!/^(?:\d{1,7}(?:\.\d{1,2})?|\.\d{1,2})$/.test(input)) return null;
  const [rupees, fraction = ''] = input.split('.');
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));
  return paise >= 1 && paise <= maxExpensePaise ? paise : null;
}

const accountDate = new Intl.DateTimeFormat('en', {
  timeZone: accountTimezone, year: 'numeric', month: '2-digit', day: '2-digit',
});

export function accountToday(now = new Date()) {
  const parts = accountDate.formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}

export function expenseMonthBounds(day: string) {
  const start = day.slice(0, 7) + '-01';
  return { start, end: shiftExpenseMonth(start, 1), previousStart: shiftExpenseMonth(start, -1) };
}

function shiftExpenseMonth(monthStart: string, offset: number) {
  const date = new Date(monthStart);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}

export function shiftExpenseDay(day: string, offset: number) {
  const date = new Date(day);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function expenseWeekDates(day: string) {
  const weekday = (new Date(day).getUTCDay() + 6) % 7;
  const monday = shiftExpenseDay(day, -weekday);
  return Array.from({ length: 7 }, (_, offset) => shiftExpenseDay(monday, offset));
}

const monthOnly = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });
const monthAndYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function expenseMonthLabel(date: string, includeYear = true) {
  return (includeYear ? monthAndYear : monthOnly).format(new Date(date));
}

export function groupExpenses<T extends { expenseDate: string }>(expenses: readonly T[], today: string) {
  const yesterday = shiftExpenseDay(today, -1);
  const groups = new Map<string, { label: string; expenses: T[] }>();

  for (const expense of expenses) {
    const date = expense.expenseDate;
    const key = date === today || date === yesterday ? date : date.slice(0, 7);
    let group = groups.get(key);
    if (!group) {
      const label = date === today ? 'Today' : date === yesterday ? 'Yesterday'
        : expenseMonthLabel(date, date.slice(0, 4) !== today.slice(0, 4));
      group = { label, expenses: [] };
      groups.set(key, group);
    }
    group.expenses.push(expense);
  }
  return [...groups].map(([key, group]) => ({ key, ...group }));
}

function formatIndianInteger(value: bigint) {
  return value.toString().replace(/\d(?=(?:\d{2})+\d$)/g, '$&,');
}

export function formatPaise(value: string | number) {
  const paise = BigInt(value);
  return '₹' + formatIndianInteger(paise / 100n) + '.' + String(paise % 100n).padStart(2, '0');
}

export function compareMonthlySpend(currentPaise: string, previousPaise: string) {
  const previous = BigInt(previousPaise);
  if (previous === 0n) return { label: 'No spending last month' };
  const difference = BigInt(currentPaise) - previous;
  if (difference === 0n) return { label: 'Same as last month' };

  const above = difference > 0n;
  const magnitude = above ? difference : -difference;
  if (difference > previous) return { label: `${formatPaise(difference.toString())} more than last month`, above };
  const percentage = (magnitude * 100n + previous / 2n) / previous;
  const formatted = percentage === 0n ? '<1' : formatIndianInteger(percentage);
  return { label: `${formatted}% ${above ? 'above' : 'below'} last month`, above };
}

export type Expense = {
  id: string;
  title: string | null;
  amountPaise: number;
  categoryId: CategoryId;
  expenseDate: string;
  note: string | null;
  version: number;
};

export type CreateExpense = {
  id: string;
  amountPaise: number;
  title: string;
  categoryId?: CategoryId;
  expenseDate?: string;
  note?: string;
};
