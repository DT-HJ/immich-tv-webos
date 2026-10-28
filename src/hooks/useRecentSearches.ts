import {useCallback, useState} from 'react';
import {addRecent, parseRecent, type SearchTerm} from '../domain/searchTerms';
import {readAccountsStore} from '../utils/accountsStore';

// Per account, like the saved filter: libraries (and what one searches them for) differ.
const STORAGE_PREFIX = 'immich_recent_searches:';

const storageKey = (): string => {
	try {
		return STORAGE_PREFIX + (readAccountsStore().lastActiveAccountId ?? '');
	} catch {
		return STORAGE_PREFIX;
	}
};

function readRecent(key: string): SearchTerm[] {
	try {
		return parseRecent(JSON.parse(localStorage.getItem(key) ?? 'null'));
	} catch {
		return [];
	}
}

/** Searches run on this TV, newest first: typing on a remote is slow, picking a chip is not. */
export const useRecentSearches = () => {
	const [key] = useState(storageKey);
	const [recent, setRecent] = useState(() => readRecent(key));

	const remember = useCallback(
		(term: SearchTerm) => {
			setRecent((current) => {
				const next = addRecent(current, term);
				try {
					localStorage.setItem(key, JSON.stringify(next));
				} catch {
					// Storage unavailable: the list still holds for this session.
				}
				return next;
			});
		},
		[key]
	);

	return [recent, remember] as const;
};
