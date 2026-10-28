import {formatBucketDate, formatYearsAgo} from '../utils/FormattingService';

export type MemoryWindow = 'day' | 'week';

export interface TakenRange {
	year: number;
	// Local midnights: `from` inclusive, `before` exclusive.
	from: Date;
	before: Date;
}

// 1970-01-01 is what a missing capture date turns into, not a year anyone took photos in.
const EPOCH_YEAR = 1970;

/**
 * Today's date in each earlier year of the library: the day itself, or the week around it
 * (three days each side). A Feb 29 has no match in other years and is skipped there.
 */
export function memoryRanges(today: Date, years: readonly number[], span: MemoryWindow): TakenRange[] {
	const month = today.getMonth();
	const day = today.getDate();
	const [start, end] = span === 'day' ? [0, 1] : [-3, 4];
	const ranges: TakenRange[] = [];
	for (const year of years) {
		if (year >= today.getFullYear() || year <= EPOCH_YEAR) continue;
		if (new Date(year, month, day).getMonth() !== month) continue;
		ranges.push({year, from: new Date(year, month, day + start), before: new Date(year, month, day + end)});
	}
	return ranges;
}

/** Day header of a memory: "2 years ago · Tuesday, Oct 29, 2024". */
export function memoryHeader(timeBucket: string, today: Date = new Date()): string {
	const year = Number(timeBucket.slice(0, 4));
	return `${formatYearsAgo(today.getFullYear() - year)} · ${formatBucketDate(timeBucket, today)}`;
}
