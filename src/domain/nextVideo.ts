import type {DayGroup, TimelineAsset, TimelineBucket} from './types';
import {monthKey} from './transforms';

/** Where autoplay goes once a video ends: the next video in viewing order, or what to load first. */
export type NextVideo = {video: TimelineAsset} | {loadMonth: string} | {loadMore: true} | null;

/** In-memory or paged list (filter, search, place): what is loaded is in order, a later page may hold more. */
export function nextVideoInList(assets: readonly TimelineAsset[], fromIndex: number, canLoadMore: boolean): NextVideo {
	for (let i = fromIndex + 1; i < assets.length; i++) {
		if (assets[i]!.type === 'VIDEO') return {video: assets[i]!};
	}
	return canLoadMore ? {loadMore: true} : null;
}

/**
 * Lazy timeline: months load out of order, so an unloaded month between the current asset and the
 * next loaded video is fetched first instead of being jumped over. A month that failed is skipped.
 */
export function nextVideoInTimeline(
	buckets: readonly TimelineBucket[],
	loadedMonths: ReadonlyMap<string, DayGroup[]>,
	failedMonths: ReadonlySet<string>,
	current: TimelineAsset
): NextVideo {
	const start = buckets.findIndex((bucket) => monthKey(bucket.timeBucket) === monthKey(current.localDateTime));
	if (start < 0) return null;
	for (let i = start; i < buckets.length; i++) {
		const timeBucket = buckets[i]!.timeBucket;
		const groups = loadedMonths.get(timeBucket);
		if (!groups) {
			if (failedMonths.has(timeBucket)) continue;
			return {loadMonth: timeBucket};
		}
		let assets = groups.flatMap((group) => group.assets);
		if (i === start) assets = assets.slice(assets.findIndex((asset) => asset.id === current.id) + 1);
		const video = assets.find((asset) => asset.type === 'VIDEO');
		if (video) return {video};
	}
	return null;
}
