import {useCallback, useState} from 'react';
import {EMPTY_SELECTION, parseSelection, type FilterSelection} from '../domain/filterSelection';
import {readAccountsStore} from '../utils/accountsStore';

// One saved filter per account: libraries differ, and so do their makes, people and albums.
const STORAGE_PREFIX = 'immich_filter:';

const storageKey = (): string => {
	try {
		return STORAGE_PREFIX + (readAccountsStore().lastActiveAccountId ?? '');
	} catch {
		return STORAGE_PREFIX;
	}
};

function readSelection(key: string): FilterSelection {
	try {
		return parseSelection(JSON.parse(localStorage.getItem(key) ?? 'null'));
	} catch {
		return EMPTY_SELECTION;
	}
}

/** The filter panel's choices, remembered across visits and app restarts. */
export const useFilterSelection = () => {
	const [key] = useState(storageKey);
	const [selection, setSelection] = useState(() => readSelection(key));

	const updateSelection = useCallback(
		(update: (current: FilterSelection) => FilterSelection) => {
			setSelection((current) => {
				const next = update(current);
				try {
					localStorage.setItem(key, JSON.stringify(next));
				} catch {
					// Storage unavailable: the choice still applies for this session.
				}
				return next;
			});
		},
		[key]
	);

	return [selection, updateSelection] as const;
};
