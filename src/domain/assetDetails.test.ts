import {cameraName, detailRows, exposureLine, sizeLine} from './assetDetails';
import type {AssetDetails, TimelineAsset} from './types';

const details = (overrides: Partial<AssetDetails> = {}): AssetDetails => ({
	id: 'a',
	fileName: 'PS9_4029.jpg',
	make: 'Panasonic',
	model: 'DC-S9',
	lens: 'LUMIX S 40mm F2',
	fNumber: 2,
	exposureTime: '1/80',
	iso: 200,
	focalLength: 40,
	width: 4000,
	height: 6000,
	fileSize: 3702989,
	city: null,
	state: null,
	country: null,
	description: null,
	people: ['Ha-eun'],
	isFavorite: false,
	...overrides,
});

const photo: TimelineAsset = {id: 'a', type: 'IMAGE', ratio: 1, localDateTime: '2026-10-28T19:38:00.000Z', durationSeconds: null};

describe('cameraName', () => {
	test('make and model, without a company suffix or a repeated make', () => {
		expect(cameraName('Panasonic', 'DC-S9')).toBe('Panasonic DC-S9');
		expect(cameraName('Apple Computer Inc.', 'iPhone 15 Pro')).toBe('Apple iPhone 15 Pro');
		expect(cameraName('Canon', 'Canon EOS R5')).toBe('Canon EOS R5');
		expect(cameraName(null, 'DC-S9')).toBe('DC-S9');
		expect(cameraName('Sony', null)).toBe('Sony');
		expect(cameraName(null, null)).toBeNull();
	});
});

test('exposure and size lines', () => {
	expect(exposureLine(details({fNumber: 1.78, focalLength: 6.764999866}))).toBe('ƒ/1.8 · 1/80 s · ISO 200 · 6.8 mm');
	expect(exposureLine(details({fNumber: null, exposureTime: null, iso: null, focalLength: null}))).toBeNull();
	expect(sizeLine(details(), false)).toBe('4000 × 6000 · 24 MP · 3.7 MB');
	expect(sizeLine(details(), true)).toBe('4000 × 6000 · 3.7 MB');
});

describe('detailRows', () => {
	test('the capture time first, then what the file recorded, empty rows left out', () => {
		const rows = detailRows(photo, details());
		expect(rows.map((row) => row.label)).toEqual(['info.taken', 'info.people', 'info.camera', 'info.lens', 'info.exposure', 'info.size', 'info.file']);
		expect(rows[0]!.lines).toEqual(['Wednesday, Oct 28, 2026', '19:38']);
	});

	test('before the details arrive, only the capture time (and a video’s length)', () => {
		expect(detailRows(photo, undefined).map((row) => row.label)).toEqual(['info.taken']);
		const video = {...photo, type: 'VIDEO' as const, durationSeconds: 373};
		expect(detailRows(video, undefined).map((row) => row.lines)).toEqual([['Wednesday, Oct 28, 2026', '19:38'], ['6:13']]);
	});

	test('a place reads city, region, country', () => {
		const rows = detailRows(photo, details({city: 'Gyeongju', state: 'Gyeongsangbuk-do', country: 'South Korea'}));
		expect(rows.find((row) => row.label === 'info.place')!.lines).toEqual(['Gyeongju, Gyeongsangbuk-do, South Korea']);
	});
});
