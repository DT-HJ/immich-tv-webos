import {APIError} from '../api/client';
import {AuthMethod} from '../api/types';
import {t} from '../i18n/i18n';

export function makeAuthErrorMessage(error: unknown, method: AuthMethod): string {
	if (error instanceof APIError) {
		if (error.status === 401) {
			return method === AuthMethod.API_KEY ? t('auth.invalidKey') : t('auth.invalidCredentials');
		}
		if (error.status) return t('auth.serverStatus', {n: error.status});
	}
	return t('auth.unreachable');
}
