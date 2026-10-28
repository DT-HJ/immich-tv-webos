import {t} from '../i18n/i18n';
import {formatCalendarDay} from '../utils/FormattingService';
import type {AssetFilter, AssetType, CameraFilter, CameraGroup} from './types';

/** Inclusive range of local calendar days, 'YYYY-MM-DD'. */
export interface DateRange {
	from: string;
	to: string;
}

/** A model chip: labels, so a choice survives a reload; `model: null` is the make's "no model". */
export interface ModelChoice {
	make: string;
	model: string | null;
}

/**
 * What the filter panel shows as chosen, by label / id, so it can be saved and restored. Labels
 * that no longer exist are pruned against the loaded lists (`pruneSelection`).
 */
export interface FilterSelection {
	type: AssetType | null;
	favorites: boolean;
	date: DateRange | null;
	makes: string[];
	noMake: boolean;
	models: ModelChoice[];
	people: string[];
	albums: string[];
}

export const EMPTY_SELECTION: FilterSelection = {
	type: null,
	favorites: false,
	date: null,
	makes: [],
	noMake: false,
	models: [],
	people: [],
	albums: [],
};

export const isEmptySelection = (s: FilterSelection): boolean =>
	!s.type && !s.favorites && !s.date && !s.makes.length && !s.noMake && !s.people.length && !s.albums.length;

export const sameModel = (a: ModelChoice, b: ModelChoice): boolean => a.make === b.make && a.model === b.model;

/** Adds `item` if absent, removes it if present. */
export function toggleItem<T>(list: readonly T[], item: T, same: (a: T, b: T) => boolean = (a, b) => a === b): T[] {
	return list.some((x) => same(x, item)) ? list.filter((x) => !same(x, item)) : [...list, item];
}

/** Toggles a make; dropping it also drops the model choices made under it. */
export function toggleMake(s: FilterSelection, make: string): FilterSelection {
	const makes = toggleItem(s.makes, make);
	return {...s, makes, models: s.models.filter((m) => makes.indexOf(m.make) >= 0)};
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (n: number): string => (n < 10 ? '0' + n : '' + n);

export const formatDay = (date: Date): string => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** Local midnight of a 'YYYY-MM-DD' day; `offsetDays` shifts it (1 → the next day's midnight). */
export function parseDay(day: string, offsetDays = 0): Date {
	const [, y, m, d] = DAY_RE.exec(day)!;
	return new Date(Number(y), Number(m) - 1, Number(d) + offsetDays);
}

export const yearRange = (year: number): DateRange => ({from: `${year}-01-01`, to: `${year}-12-31`});

/** The year a range covers exactly, or null for any other range. */
export function rangeYear(range: DateRange | null): number | null {
	if (!range) return null;
	const year = Number(range.from.slice(0, 4));
	return range.from === `${year}-01-01` && range.to === `${year}-12-31` ? year : null;
}

export interface FilterLists {
	makes: readonly CameraGroup[];
	// Models of each chosen make, by make label; a make still loading is absent.
	modelsByMake: ReadonlyMap<string, readonly CameraGroup[]>;
}

/** The server filter for a selection. Labels missing from the lists are left out. */
export function resolveFilter(s: FilterSelection, lists: FilterLists): AssetFilter {
	const cameras: CameraFilter[] = [];
	for (const label of s.makes) {
		const make = lists.makes.find((group) => group.label === label);
		if (!make) continue;
		const chosen = s.models.filter((m) => m.make === label);
		const models = lists.modelsByMake.get(label) ?? [];
		const modelValues = chosen.flatMap((m) => models.find((group) => group.label === m.model)?.values ?? []);
		const noModel = chosen.some((m) => m.model === null);
		cameras.push({
			makes: make.values,
			...(modelValues.length ? {models: modelValues} : {}),
			...(noModel ? {noModel: true} : {}),
		});
	}
	const filter: AssetFilter = {};
	if (s.type) filter.type = s.type;
	if (s.favorites) filter.favorites = true;
	if (s.date) {
		filter.takenFrom = parseDay(s.date.from).toISOString();
		filter.takenBefore = parseDay(s.date.to, 1).toISOString();
	}
	if (cameras.length) filter.cameras = cameras;
	if (s.noMake) filter.noMake = true;
	if (s.people.length) filter.personIds = [...s.people];
	if (s.albums.length) filter.albumIds = [...s.albums];
	return filter;
}

export interface PruneLists extends FilterLists {
	personIds?: readonly string[];
	albumIds?: readonly string[];
}

/**
 * Drops choices that no longer exist (a restored make that is gone, a model of a make whose models
 * have loaded without it). Lists still loading (undefined / absent) keep their choices.
 */
export function pruneSelection(s: FilterSelection, lists: PruneLists): FilterSelection {
	const makes = s.makes.filter((label) => lists.makes.some((group) => group.label === label));
	const models = s.models.filter((m) => {
		if (makes.indexOf(m.make) < 0) return false;
		if (m.model === null) return true;
		const loaded = lists.modelsByMake.get(m.make);
		return !loaded || loaded.some((group) => group.label === m.model);
	});
	const people = lists.personIds ? s.people.filter((id) => lists.personIds!.indexOf(id) >= 0) : s.people;
	const albums = lists.albumIds ? s.albums.filter((id) => lists.albumIds!.indexOf(id) >= 0) : s.albums;
	const unchanged =
		makes.length === s.makes.length && models.length === s.models.length && people.length === s.people.length && albums.length === s.albums.length;
	return unchanged ? s : {...s, makes, models, people, albums};
}

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((x) => typeof x === 'string');

/** A saved selection, defensively: anything malformed falls back to the empty value. */
export function parseSelection(raw: unknown): FilterSelection {
	if (!raw || typeof raw !== 'object') return EMPTY_SELECTION;
	const r = raw as Record<string, unknown>;
	const date = r.date as Partial<DateRange> | null | undefined;
	const validDate = date && typeof date.from === 'string' && typeof date.to === 'string' && DAY_RE.test(date.from) && DAY_RE.test(date.to) && date.from <= date.to;
	const models = Array.isArray(r.models)
		? (r.models as unknown[]).filter(
				(m): m is ModelChoice =>
					!!m && typeof m === 'object' && typeof (m as ModelChoice).make === 'string' && ((m as ModelChoice).model === null || typeof (m as ModelChoice).model === 'string')
			)
		: [];
	return {
		type: r.type === 'IMAGE' || r.type === 'VIDEO' ? r.type : null,
		favorites: r.favorites === true,
		date: validDate ? {from: date!.from!, to: date!.to!} : null,
		makes: isStringArray(r.makes) ? r.makes : [],
		noMake: r.noMake === true,
		models: models.map((m) => ({make: m.make, model: m.model})),
		people: isStringArray(r.people) ? r.people : [],
		albums: isStringArray(r.albums) ? r.albums : [],
	};
}

export function formatDayLabel(day: string): string {
	const date = parseDay(day);
	return formatCalendarDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function describeDate(range: DateRange): string {
	const year = rangeYear(range);
	if (year !== null) return String(year);
	return range.from === range.to ? formatDayLabel(range.from) : `${formatDayLabel(range.from)} – ${formatDayLabel(range.to)}`;
}

/** Summary line above the results, e.g. "Videos · Sony, Others · 2025 · Favorites". */
export function describeSelection(s: FilterSelection, names: {people?: ReadonlyMap<string, string>; albums?: ReadonlyMap<string, string>} = {}): string {
	const parts = [t(s.type === 'IMAGE' ? 'filter.photos' : s.type === 'VIDEO' ? 'filter.videos' : 'filter.photosAndVideos')];
	const cameras = s.makes.map((make) => {
		const models = s.models.filter((m) => m.make === make).map((m) => m.model ?? t('filter.noModel'));
		return models.length ? `${make} ${models.join('/')}` : make;
	});
	if (s.noMake) cameras.push(t('filter.others'));
	if (cameras.length) parts.push(cameras.join(', '));
	if (s.date) parts.push(describeDate(s.date));
	const people = s.people.map((id) => names.people?.get(id)).filter(Boolean);
	if (people.length) parts.push(people.join(', '));
	const albums = s.albums.map((id) => names.albums?.get(id)).filter(Boolean);
	if (albums.length) parts.push(albums.join(', '));
	if (s.favorites) parts.push(t('filter.favoritesPlain'));
	return parts.join(' · ');
}
