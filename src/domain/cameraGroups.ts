import type {CameraGroup} from './types';

// Placeholders some cameras and apps write instead of leaving the tag empty.
const PLACEHOLDERS = new Set(['', 'none', 'unknown']);

// Mixed case reads best ('Sony' over 'SONY', 'Samsung' over 'samsung').
function labelRank(value: string): number {
	if (value !== value.toUpperCase() && value !== value.toLowerCase()) return 0;
	return value === value.toUpperCase() ? 1 : 2;
}

/**
 * Folds spellings that differ only by case (or surrounding spaces) into one entry, keeping every
 * exact spelling so the server, which matches exactly, can be queried with all of them.
 */
export function groupCaseVariants(values: readonly string[]): CameraGroup[] {
	const groups = new Map<string, string[]>();
	for (const value of values) {
		const key = value.trim().toLowerCase();
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
