import {addRecent, parseRecent, suggestedTerms, termFromInput} from './searchTerms';

describe('termFromInput', () => {
	test('English is sent as typed, spaces tidied', () => {
		expect(termFromInput('  dog   on the beach ')).toEqual({label: 'dog on the beach', query: 'dog on the beach'});
		expect(termFromInput('   ')).toBeNull();
	});

	test('a Korean suggestion or known word becomes its English query', () => {
		expect(termFromInput('바다')).toEqual({label: '바다', query: 'beach'});
		expect(termFromInput('생일 케이크')).toEqual({label: '생일 케이크', query: 'birthday cake'});
		expect(termFromInput('겨울 바다')).toEqual({label: '겨울 바다', query: 'winter beach'});
	});

	test('an unknown Korean word is kept as typed', () => {
		expect(termFromInput('길동 놀이터')).toEqual({label: '길동 놀이터', query: '길동 playground'});
	});
});

test('suggestions are labelled in the UI language with English queries', () => {
	expect(suggestedTerms('ko')[0]).toEqual({label: '바다', query: 'beach'});
	expect(suggestedTerms('en')[0]).toEqual({label: 'Beach', query: 'beach'});
});

describe('recent searches', () => {
	test('newest first, one per label, at most eight', () => {
		let recent = addRecent([], {label: 'a', query: 'a'});
		recent = addRecent(recent, {label: 'b', query: 'b'});
		recent = addRecent(recent, {label: 'a', query: 'a'});
		expect(recent.map((r) => r.label)).toEqual(['a', 'b']);
		for (let i = 0; i < 10; i++) recent = addRecent(recent, {label: `x${i}`, query: `x${i}`});
		expect(recent).toHaveLength(8);
		expect(recent[0]!.label).toBe('x9');
	});

	test('a malformed saved list reads as empty or loses its bad entries', () => {
		expect(parseRecent(null)).toEqual([]);
		expect(parseRecent({label: 'a'})).toEqual([]);
		expect(parseRecent([{label: 'a', query: 'b'}, {label: 1}, 'x'])).toEqual([{label: 'a', query: 'b'}]);
	});
});
