import {getLanguage, setLanguage, t} from './i18n';
import {en, ko} from './messages';

afterEach(() => setLanguage('en'));

describe('t', () => {
	test('follows the language and fills placeholders', () => {
		expect(getLanguage()).toBe('en');
		expect(t('nav.memories')).toBe('Memories');
		expect(t('count.items', {n: '1,234'})).toBe('1,234 items');
		setLanguage('ko');
		expect(t('nav.memories')).toBe('추억');
		expect(t('count.items', {n: '1,234'})).toBe('항목 1,234개');
	});

	test('leaves a placeholder without a value as written', () => {
		expect(t('search.results')).toBe('Results for “{q}”');
	});

	test('every English string has a Korean one with the same placeholders', () => {
		const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join();
		for (const key of Object.keys(en) as (keyof typeof en)[]) {
			expect(ko[key]).toBeTruthy();
			expect(placeholders(ko[key])).toBe(placeholders(en[key]));
		}
	});
});
