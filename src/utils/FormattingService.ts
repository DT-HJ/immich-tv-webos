import {getLanguage, t, type MessageKey} from '../i18n/i18n';

// Immich servers before v3 send asset durations as "H:MM:SS.mmm" strings; v3+ sends
// milliseconds. Normalize both to seconds at the API boundary.
export function toDurationSeconds(duration: string | number | null | undefined): number | null {
	if (duration == null) return null;
	if (typeof duration === 'number') return duration / 1000;
	const [hStr, mStr, sStr] = duration.split(':');
	if (!hStr || !mStr || !sStr) return null;
	return parseInt(hStr, 10) * 3600 + parseInt(mStr, 10) * 60 + parseFloat(sStr);
}

export function formatDuration(durationSeconds: number): string {
	const total = Math.floor(durationSeconds);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;

	return hours > 0
		? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
		: `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export type CountNoun = 'item' | 'album' | 'place';

export function formatCount(count: number, noun: CountNoun): string {
	const key = (count === 1 ? `count.${noun}` : `count.${noun}s`) as MessageKey;
	return t(key, {n: count.toLocaleString('en-US')});
}

/** A partly loaded collection whose total isn't known: "500+ items". */
export function formatCountAtLeast(count: number): string {
	return t('count.itemsMore', {n: count.toLocaleString('en-US')});
}

const pad2 = (n: number): string => (n < 10 ? '0' + n : '' + n);
const KO_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// Korean dates are put together by hand: the TV's ICU and the test runner's agree on English,
// not on the spacing of Korean patterns.
function koreanDay(year: number, month: number, day: number, weekday: number, {withYear = true, longWeekday = false} = {}): string {
	const weekdayName = longWeekday ? `${KO_WEEKDAYS[weekday]}요일` : `(${KO_WEEKDAYS[weekday]})`;
	return `${withYear ? `${year}년 ` : ''}${month}월 ${day}일 ${weekdayName}`;
}

function koreanTime(hours: number, minutes: number): string {
	return `${hours < 12 ? '오전' : '오후'} ${hours % 12 || 12}:${pad2(minutes)}`;
}

export function formatBucketMonth(timeBucket: string): string {
	const [year, month] = timeBucket.split('-').map(Number);
	if (!year || !month || month < 1 || month > 12) return timeBucket;
	if (getLanguage() === 'ko') return `${year}년 ${month}월`;
	return new Date(year, month - 1).toLocaleDateString('en-US', {month: 'short', year: 'numeric'});
}

export function formatBucketDate(timeBucket: string, today: Date = new Date()): string {
	const [year, month, day] = timeBucket.split('-').map(Number);
	if (year === undefined || month === undefined || day === undefined) return timeBucket;
	const date = new Date(year, month - 1, day);

	const midnight = new Date(today);
	midnight.setHours(0, 0, 0, 0);

	const yesterday = new Date(midnight);
	yesterday.setDate(yesterday.getDate() - 1);

	const dateNormalized = new Date(date);
	dateNormalized.setHours(0, 0, 0, 0);

	if (dateNormalized.getTime() === midnight.getTime()) return t('date.today');
	if (dateNormalized.getTime() === yesterday.getTime()) return t('date.yesterday');

	if (getLanguage() === 'ko') return koreanDay(year, month, day, date.getDay(), {withYear: year !== midnight.getFullYear()});
	return date.toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'});
}

// localDateTime carries the wall-clock time in UTC fields, so it's formatted in UTC.
export function formatAssetDateTime(localDateTime: string): {date: string; time: string} {
	const date = new Date(localDateTime);
	if (getLanguage() === 'ko') {
		return {
			date: koreanDay(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCDay(), {longWeekday: true}),
			time: koreanTime(date.getUTCHours(), date.getUTCMinutes()),
		};
	}
	return {
		date: date.toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'}),
		time: date.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit', timeZone: 'UTC'}),
	};
}

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A calendar day without its weekday: "Oct 28, 2026" / "2026년 10월 28일". */
export function formatCalendarDay(year: number, month: number, day: number): string {
	return getLanguage() === 'ko' ? `${year}년 ${month}월 ${day}일` : `${EN_MONTHS[month - 1]} ${day}, ${year}`;
}

/** "Oct 29" / "10월 29일". */
export function formatMonthDay(month: number, day: number): string {
	return getLanguage() === 'ko' ? `${month}월 ${day}일` : `${EN_MONTHS[month - 1]} ${day}`;
}

export function formatYearsAgo(years: number): string {
	return years === 1 ? t('date.yearAgo') : t('date.yearsAgo', {n: years});
}

export function formatFileSize(bytes: number): string {
	if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
	if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
	return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}
