import {APIError} from '../api/client';
import {t} from '../i18n/i18n';

export function presentError(err: unknown): string {
	if (err instanceof APIError) {
		if (err.status === 401) return t('error.signIn');
		if (err.status === 403) return t('error.denied');
		if (err.status === 404) return t('error.notFound');
		if (err.status && err.status >= 500) return t('error.server');
		if (!err.status) return t('error.network');
	}
	return t('error.generic');
}
