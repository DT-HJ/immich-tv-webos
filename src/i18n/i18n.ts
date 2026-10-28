import {en, ko, type MessageKey} from './messages';

export type Language = 'en' | 'ko';

// The TV's system language, as webOS reports it to the web runtime (navigator.language is
// 'ko-KR' on a TV set to Korean). Anything but Korean gets the English UI.
function detectLanguage(): Language {
	try {
		const language = typeof navigator !== 'undefined' ? navigator.language || '' : '';
		return /^ko\b/i.test(language) ? 'ko' : 'en';
	} catch {
		return 'en';
	}
}

let current: Language = detectLanguage();

export const getLanguage = (): Language => current;

/** Tests only: the language is otherwise fixed for the app's lifetime. */
export const setLanguage = (language: Language): void => {
	current = language;
};

export type {MessageKey};

/** The string for `key` in the UI language, `{name}` placeholders filled from `params`. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
	const template = (current === 'ko' ? ko : en)[key] ?? en[key] ?? key;
	if (!params) return template;
	return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}
