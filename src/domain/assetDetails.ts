import {t, type MessageKey} from '../i18n/i18n';
import {formatAssetDateTime, formatDuration, formatFileSize} from '../utils/FormattingService';
import {bareMake} from './cameraGroups';
import type {AssetDetails, TimelineAsset} from './types';

export interface DetailRow {
	label: MessageKey;
	lines: string[];
}

const trimNumber = (value: number, digits: number): string => String(Number(value.toFixed(digits)));

/** "Panasonic DC-S9"; a model that already names its maker ("Canon EOS R5") stands alone. */
export function cameraName(make: string | null, model: string | null): string | null {
	const maker = make ? bareMake(make) : '';
	if (!model) return maker || null;
	return maker && model.toLowerCase().indexOf(maker.toLowerCase()) !== 0 ? `${maker} ${model}` : model;
}

/** "ƒ/1.8 · 1/41 s · ISO 640 · 6.8 mm", from whatever the file recorded. */
export function exposureLine(details: AssetDetails): string | null {
	const parts: string[] = [];
	if (details.fNumber) parts.push(`ƒ/${trimNumber(details.fNumber, 1)}`);
	if (details.exposureTime) parts.push(`${details.exposureTime} s`);
	if (details.iso) parts.push(`ISO ${details.iso}`);
	if (details.focalLength) parts.push(`${trimNumber(details.focalLength, 1)} mm`);
	return parts.length ? parts.join(' · ') : null;
}

/** "4284 × 5712 · 24.5MP · 1.8 MB". */
export function sizeLine(details: AssetDetails, isVideo: boolean): string | null {
	const parts: string[] = [];
	if (details.width && details.height) {
		parts.push(`${details.width} × ${details.height}`);
		if (!isVideo) parts.push(t('info.megapixels', {n: trimNumber((details.width * details.height) / 1e6, 1)}));
	}
	if (details.fileSize) parts.push(formatFileSize(details.fileSize));
	return parts.length ? parts.join(' · ') : null;
}

/** The details panel, top to bottom; rows the file has no data for are left out. */
export function detailRows(asset: TimelineAsset, details: AssetDetails | undefined): DetailRow[] {
	const isVideo = asset.type === 'VIDEO';
	const {date, time} = formatAssetDateTime(asset.localDateTime);
	const rows: DetailRow[] = [{label: 'info.taken', lines: [date, time]}];
	if (isVideo && asset.durationSeconds !== null) rows.push({label: 'info.duration', lines: [formatDuration(asset.durationSeconds)]});
	if (!details) return rows;
	const add = (label: MessageKey, line: string | null) => {
		if (line) rows.push({label, lines: [line]});
	};
	if (details.people.length) rows.push({label: 'info.people', lines: [details.people.join(', ')]});
	const place = [details.city, details.state, details.country].filter(Boolean).join(', ');
	add('info.place', place || null);
	add('info.camera', cameraName(details.make, details.model));
	add('info.lens', details.lens);
	if (!isVideo) add('info.exposure', exposureLine(details));
	add('info.size', sizeLine(details, isVideo));
	add('info.file', details.fileName);
	add('info.description', details.description);
	return rows;
}
