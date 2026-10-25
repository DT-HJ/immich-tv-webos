import {groupCaseVariants} from './cameraGroups';

describe('groupCaseVariants', () => {
	it('folds case variants under the mixed-case spelling and keeps every exact value', () => {
		expect(groupCaseVariants(['SONY', 'samsung', 'Sony', 'SAMSUNG', 'Samsung'])).toEqual([
			{label: 'Samsung', values: ['samsung', 'SAMSUNG', 'Samsung']},
			{label: 'Sony', values: ['SONY', 'Sony']},
		]);
	});

	it('keeps single spellings as they are, whatever their case', () => {
		expect(groupCaseVariants(['motorola', 'NIKON CORPORATION'])).toEqual([
			{label: 'motorola', values: ['motorola']},
			{label: 'NIKON CORPORATION', values: ['NIKON CORPORATION']},
		]);
	});

	it('prefers upper case over lower case when no mixed-case spelling exists', () => {
		expect(groupCaseVariants(['fujifilm', 'FUJIFILM'])).toEqual([{label: 'FUJIFILM', values: ['fujifilm', 'FUJIFILM']}]);
	});

	it('does not merge different names that share a prefix', () => {
		expect(groupCaseVariants(['Apple', 'Apple Computer Inc.']).map((g) => g.label)).toEqual(['Apple', 'Apple Computer Inc.']);
	});

	it('drops placeholders and duplicates, and folds surrounding spaces', () => {
		expect(groupCaseVariants(['none', '', 'Canon', 'Canon', 'Canon '])).toEqual([{label: 'Canon', values: ['Canon', 'Canon ']}]);
	});
});
