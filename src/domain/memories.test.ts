import {memoryHeader, memoryRanges} from './memories';

const day = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

describe('memoryRanges', () => {
	const today = new Date(2026, 9, 29, 21, 30);

	test('today’s date in each earlier year, local midnight to midnight', () => {
		const ranges = memoryRanges(today, [2026, 2025, 2018], 'day');
		expect(ranges.map((r) => r.year)).toEqual([2025, 2018]);
		expect(day(ranges[0]!.from)).toBe('2025-10-29');
		expect(ranges[0]!.from.getHours()).toBe(0);
		expect(day(ranges[0]!.before)).toBe('2025-10-30');
	});

	test('the week window spans three days each side', () => {
		const [range] = memoryRanges(today, [2024], 'week');
		expect(day(range!.from)).toBe('2024-10-26');
		expect(day(range!.before)).toBe('2024-11-2');
	});

	test('skips the epoch placeholder year and Feb 29 in years without one', () => {
		expect(memoryRanges(today, [1970], 'day')).toEqual([]);
		const leapDay = new Date(2028, 1, 29);
		expect(memoryRanges(leapDay, [2024, 2023], 'day').map((r) => r.year)).toEqual([2024]);
	});
});

test('memoryHeader names how long ago the day was', () => {
	expect(memoryHeader('2024-10-29', new Date(2026, 9, 29))).toBe('2 years ago · Tuesday, Oct 29, 2024');
});
