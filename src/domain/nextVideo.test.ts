import {nextVideoInList, nextVideoInTimeline} from './nextVideo';
import type {DayGroup, TimelineAsset} from './types';

const image = (id: string, localDateTime = '2026-10-18T10:00:00.000Z'): TimelineAsset => ({id, type: 'IMAGE', ratio: 1, localDateTime, durationSeconds: null});
const video = (id: string, localDateTime?: string): TimelineAsset => ({...image(id, localDateTime), type: 'VIDEO', durationSeconds: 3});
const month = (timeBucket: string, assets: TimelineAsset[]): DayGroup[] => [{timeBucket, assets, count: assets.length}];

describe('nextVideoInList', () => {
	const assets = [video('v1'), image('a'), image('b'), video('v2'), image('c')];

	test('skips photos to the next video', () => {
		expect(nextVideoInList(assets, 0, false)).toEqual({video: assets[3]});
	});

	test('past the last loaded video: asks for another page, or stops', () => {
		expect(nextVideoInList(assets, 3, true)).toEqual({loadMore: true});
		expect(nextVideoInList(assets, 3, false)).toBeNull();
	});
});

describe('nextVideoInTimeline', () => {
	const buckets = ['2026-10-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'].map((timeBucket) => ({timeBucket, count: 2}));
	const current = video('v1', '2026-10-18T10:00:00.000Z');
	const october = month(buckets[0]!.timeBucket, [image('newer'), current, image('a')]);
	const august = month(buckets[2]!.timeBucket, [video('v3', '2026-08-02T10:00:00.000Z')]);

	test('later in the same month', () => {
		const withVideo = month(buckets[0]!.timeBucket, [current, image('a'), video('v2')]);
		const loaded = new Map([[buckets[0]!.timeBucket, withVideo]]);
		expect(nextVideoInTimeline(buckets, loaded, new Set(), current)).toEqual({video: withVideo[0]!.assets[2]});
	});

	test('an unloaded month in between is loaded before jumping past it', () => {
		const loaded = new Map([
			[buckets[0]!.timeBucket, october],
			[buckets[2]!.timeBucket, august],
		]);
		expect(nextVideoInTimeline(buckets, loaded, new Set(), current)).toEqual({loadMonth: buckets[1]!.timeBucket});
	});

	test('a failed month is skipped, and the timeline end stops', () => {
		const loaded = new Map([
			[buckets[0]!.timeBucket, october],
			[buckets[2]!.timeBucket, august],
		]);
		expect(nextVideoInTimeline(buckets, loaded, new Set([buckets[1]!.timeBucket]), current)).toEqual({video: august[0]!.assets[0]});
		expect(nextVideoInTimeline(buckets, new Map([...loaded, [buckets[1]!.timeBucket, []]]), new Set(), august[0]!.assets[0]!)).toBeNull();
	});
});
