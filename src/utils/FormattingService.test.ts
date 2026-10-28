import {setLanguage} from '../i18n/i18n';
import {
	formatAssetDateTime,
	formatBucketDate,
	formatBucketMonth,
	formatCalendarDay,
	formatCount,
	formatCountAtLeast,
	formatDuration,
	formatFileSize,
	formatMonthDay,
	formatYearsAgo,
	toDurationSeconds,
} from './FormattingService';

describe('toDurationSeconds', () => {
	it('parses legacy "H:MM:SS.mmm" strings (Immich < v3)', () => {
		expect(toDurationSeconds('0:01:46.786')).toBeCloseTo(106.786);
		expect(toDurationSeconds('1:02:03.000')).toBeCloseTo(3723);
	});

	it('converts millisecond numbers (Immich v3+)', () => {
		expect(toDurationSeconds(106786)).toBeCloseTo(106.786);
		expect(toDurationSeconds(0)).toBe(0);
	});

	it('returns null for null, undefined and malformed strings', () => {
		expect(toDurationSeconds(null)).toBeNull();
		expect(toDurationSeconds(undefined)).toBeNull();
		expect(toDurationSeconds('not-a-duration')).toBeNull();
	});
});

describe('formatDuration', () => {
	it('formats sub-hour durations as M:SS', () => {
		expect(formatDuration(106.786)).toBe('1:46');
		expect(formatDuration(9)).toBe('0:09');
	});

	it('formats hour-plus durations as H:MM:SS', () => {
		expect(formatDuration(3723)).toBe('1:02:03');
	});
});

describe('formatAssetDateTime', () => {
	test('formats the wall-clock fields regardless of the TV timezone', () => {
		expect(formatAssetDateTime('2016-08-30T23:49:37.000Z')).toEqual({date: 'Tuesday, Aug 30, 2016', time: '23:49'});
	});
});

describe('formatCount', () => {
	it('pluralizes and groups thousands', () => {
		expect(formatCount(1, 'item')).toBe('1 item');
		expect(formatCount(0, 'album')).toBe('0 albums');
		expect(formatCount(1234, 'item')).toBe('1,234 items');
	});
});

describe('Korean formatting', () => {
	beforeEach(() => setLanguage('ko'));
	afterEach(() => setLanguage('en'));

	test('day headers name today and yesterday, and drop the year only for this one', () => {
		const today = new Date(2026, 9, 29, 15, 0);
		expect(formatBucketDate('2026-10-29', today)).toBe('오늘');
		expect(formatBucketDate('2026-10-28', today)).toBe('어제');
		expect(formatBucketDate('2026-10-27', today)).toBe('10월 27일 (화)');
		expect(formatBucketDate('2025-10-29', today)).toBe('2025년 10월 29일 (수)');
	});

	test('viewer date and 12-hour time from the wall-clock fields', () => {
		expect(formatAssetDateTime('2016-08-30T23:49:37.000Z')).toEqual({date: '2016년 8월 30일 화요일', time: '오후 11:49'});
		expect(formatAssetDateTime('2016-08-30T00:05:00.000Z')).toEqual({date: '2016년 8월 30일 화요일', time: '오전 12:05'});
		expect(formatAssetDateTime('2016-08-30T12:00:00.000Z').time).toBe('오후 12:00');
	});

	test('months, counts and days', () => {
		expect(formatBucketMonth('2026-10-01')).toBe('2026년 10월');
		expect(formatCount(1234, 'item')).toBe('항목 1,234개');
		expect(formatCount(1, 'album')).toBe('앨범 1개');
		expect(formatCount(3, 'place')).toBe('장소 3곳');
		expect(formatCountAtLeast(500)).toBe('항목 500개 이상');
		expect(formatCalendarDay(2026, 10, 28)).toBe('2026년 10월 28일');
		expect(formatMonthDay(10, 29)).toBe('10월 29일');
		expect(formatYearsAgo(1)).toBe('1년 전');
		expect(formatYearsAgo(8)).toBe('8년 전');
	});
});

describe('English formatting', () => {
	test('day headers, months and relative years', () => {
		const today = new Date(2026, 9, 29, 15, 0);
		expect(formatBucketDate('2026-10-29', today)).toBe('Today');
		expect(formatBucketDate('2026-10-28', today)).toBe('Yesterday');
		expect(formatBucketDate('2025-10-29', today)).toBe('Wednesday, Oct 29, 2025');
		expect(formatBucketMonth('2026-10-01')).toBe('Oct 2026');
		expect(formatCountAtLeast(500)).toBe('500+ items');
		expect(formatCalendarDay(2026, 10, 28)).toBe('Oct 28, 2026');
		expect(formatYearsAgo(1)).toBe('1 year ago');
		expect(formatYearsAgo(2)).toBe('2 years ago');
	});

	test('file sizes', () => {
		expect(formatFileSize(3702989)).toBe('3.7 MB');
		expect(formatFileSize(1.2e9)).toBe('1.2 GB');
		expect(formatFileSize(300)).toBe('1 KB');
	});
});
