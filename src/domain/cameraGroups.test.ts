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

	it('folds company suffixes under the bare name', () => {
		expect(groupCaseVariants(['Apple Computer Inc.', 'Apple'])).toEqual([{label: 'Apple', values: ['Apple Computer Inc.', 'Apple']}]);
		expect(groupCaseVariants(['FUJIFILM Corporation', 'FUJIFILM'])).toEqual([{label: 'FUJIFILM', values: ['FUJIFILM Corporation', 'FUJIFILM']}]);
		expect(groupCaseVariants(['SAMSUNG Co., Ltd.', 'Samsung'])).toEqual([{label: 'Samsung', values: ['SAMSUNG Co., Ltd.', 'Samsung']}]);
	});

	it('keeps a lone suffixed name as written', () => {
		expect(groupCaseVariants(['NIKON CORPORATION'])).toEqual([{label: 'NIKON CORPORATION', values: ['NIKON CORPORATION']}]);
	});

	it('does not merge different names that share a prefix', () => {
		expect(groupCaseVariants(['Sony', 'Sony Ericsson', 'SK communications']).map((g) => g.label)).toEqual([
			'SK communications',
			'Sony',
			'Sony Ericsson',
		]);
	});

	it('drops placeholders and duplicates, and folds surrounding spaces', () => {
		expect(groupCaseVariants(['none', '', 'Canon', 'Canon', 'Canon '])).toEqual([{label: 'Canon', values: ['Canon', 'Canon ']}]);
	});
});
