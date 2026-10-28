import type {CameraGroup} from './types';

// Placeholders some cameras and apps write instead of leaving the tag empty.
const PLACEHOLDERS = new Set(['', 'none', 'unknown']);

// Company-form suffixes some firmwares append: 'Apple Computer Inc.' is 'Apple',
// 'NIKON CORPORATION' is 'Nikon'. Only whole trailing words, so 'SK communications' stays.
const COMPANY_SUFFIX = /(?:[\s,]+(?:computer\s+inc|inc|incorporated|corp|corporation|co|company|ltd|limited)\.?)+$/;

const groupKey = (value: string): string => value.trim().toLowerCase().replace(COMPANY_SUFFIX, '');

/** A make as people say it: 'Apple Computer Inc.' → 'Apple', 'NIKON CORPORATION' → 'NIKON'. */
export const bareMake = (make: string): string => make.trim().replace(new RegExp(COMPANY_SUFFIX.source, 'i'), '');

// The bare name reads best ('Apple' over 'Apple Computer Inc.'), then mixed case ('Sony' over
// 'SONY', 'Samsung' over 'samsung').
function labelRank(value: string): number {
	const suffixed = COMPANY_SUFFIX.test(value.trim().toLowerCase()) ? 3 : 0;
	if (value !== value.toUpperCase() && value !== value.toLowerCase()) return suffixed;
	return suffixed + (value === value.toUpperCase() ? 1 : 2);
}

/**
 * Folds spellings of one name (case, surrounding spaces, company suffix) into one entry, keeping
 * every exact spelling so the server, which matches exactly, can be queried with all of them.
 */
export function groupCaseVariants(values: readonly string[]): CameraGroup[] {
	const groups = new Map<string, string[]>();
	for (const value of values) {
		const key = groupKey(value);
		if (PLACEHOLDERS.has(key)) continue;
		const variants = groups.get(key);
		if (!variants) groups.set(key, [value]);
		else if (variants.indexOf(value) < 0) variants.push(value);
	}
	return Array.from(groups.values())
		.map((variants) => {
			let label = variants[0]!;
			for (const candidate of variants) {
				if (labelRank(candidate) < labelRank(label)) label = candidate;
			}
			return {label: label.trim(), values: variants};
		})
		.sort((a, b) => a.label.localeCompare(b.label, undefined, {sensitivity: 'base'}));
}
