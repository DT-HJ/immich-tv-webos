import {
	describeSelection,
	EMPTY_SELECTION,
	parseDay,
	parseSelection,
	pruneSelection,
	rangeYear,
	resolveFilter,
	toggleMake,
	yearRange,
	type FilterSelection,
} from './filterSelection';

const makes = [
	{label: 'Panasonic', values: ['Panasonic']},
	{label: 'Sony', values: ['SONY', 'Sony']},
];
const modelsByMake = new Map([['Sony', [{label: 'ILCE-7CM2', values: ['ILCE-7CM2']}]]]);
const selection = (patch: Partial<FilterSelection>): FilterSelection => ({...EMPTY_SELECTION, ...patch});

describe('resolveFilter', () => {
	test('several makes, a model of one, and Others become camera alternatives', () => {
		const s = selection({
			type: 'VIDEO',
			makes: ['Sony', 'Panasonic'],
			models: [
				{make: 'Sony', model: 'ILCE-7CM2'},
				{make: 'Sony', model: null},
			],
			noMake: true,
		});
		expect(resolveFilter(s, {makes, modelsByMake})).toEqual({
			type: 'VIDEO',
			cameras: [{makes: ['SONY', 'Sony'], models: ['ILCE-7CM2'], noModel: true}, {makes: ['Panasonic']}],
			noMake: true,
		});
	});

	test('a day range covers local midnight to the midnight after its last day', () => {
		const filter = resolveFilter(selection({date: {from: '2026-10-01', to: '2026-10-26'}}), {makes, modelsByMake});
		expect(filter.takenFrom).toBe(new Date(2026, 9, 1).toISOString());
		expect(filter.takenBefore).toBe(new Date(2026, 9, 27).toISOString());
	});

	test('labels missing from the lists are left out', () => {
		expect(resolveFilter(selection({makes: ['Canon']}), {makes, modelsByMake})).toEqual({});
	});
});

describe('selection helpers', () => {
	test('dropping a make drops its model choices', () => {
		const s = selection({makes: ['Sony', 'Panasonic'], models: [{make: 'Sony', model: 'ILCE-7CM2'}]});
		expect(toggleMake(s, 'Sony')).toEqual(selection({makes: ['Panasonic'], models: []}));
	});

	test('year ranges round-trip, and parseDay is local', () => {
		expect(rangeYear(yearRange(2025))).toBe(2025);
		expect(rangeYear({from: '2025-01-01', to: '2025-06-30'})).toBeNull();
		expect(parseDay('2025-03-31', 1)).toEqual(new Date(2025, 3, 1));
	});

	test('prune drops what is gone but keeps choices whose list is still loading', () => {
		const s = selection({makes: ['Sony', 'Canon'], models: [{make: 'Sony', model: 'Gone'}], people: ['p1', 'p2'], albums: ['a1']});
		expect(pruneSelection(s, {makes, modelsByMake, personIds: ['p1']})).toEqual(selection({makes: ['Sony'], models: [], people: ['p1'], albums: ['a1']}));
		const unchanged = selection({makes: ['Sony']});
		expect(pruneSelection(unchanged, {makes, modelsByMake})).toBe(unchanged);
	});

	test('parse keeps a well-formed save and rejects malformed fields', () => {
		const s = selection({type: 'VIDEO', favorites: true, date: {from: '2025-01-01', to: '2025-12-31'}, makes: ['Sony'], noMake: true, models: [{make: 'Sony', model: null}], people: ['p1']});
		expect(parseSelection(JSON.parse(JSON.stringify(s)))).toEqual(s);
		expect(parseSelection({type: 'GIF', date: {from: '2025-12-31', to: '2025-01-01'}, makes: [1], models: [{make: 'Sony'}]})).toEqual(EMPTY_SELECTION);
		expect(parseSelection(null)).toEqual(EMPTY_SELECTION);
	});

	test('summary names the choices', () => {
		const s = selection({type: 'VIDEO', makes: ['Sony'], models: [{make: 'Sony', model: null}], noMake: true, date: yearRange(2025), people: ['p1'], favorites: true});
		expect(describeSelection(s, {people: new Map([['p1', 'Ha-eun']])})).toBe('Videos · Sony no model, Others · 2025 · Ha-eun · Favorites');
	});
});
