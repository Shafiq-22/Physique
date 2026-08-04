import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import type { ISODate } from './types';

export const toISODate = (d: Date): ISODate => format(d, 'yyyy-MM-dd');

export const todayISO = (): ISODate => toISODate(new Date());

export const parseDate = (d: ISODate): Date => parseISO(d);

/** Whole calendar days from `a` to `b` (positive when `b` is later). */
export const daysBetween = (a: ISODate, b: ISODate): number =>
  differenceInCalendarDays(parseDate(b), parseDate(a));

export const shiftDays = (d: ISODate, n: number): ISODate =>
  toISODate(subDays(parseDate(d), -n));

export const isoCompare = (a: ISODate, b: ISODate): number => (a < b ? -1 : a > b ? 1 : 0);

/** Human label used across cards: "Mon 4 Aug". */
export const shortLabel = (d: ISODate): string => format(parseDate(d), 'EEE d MMM');
