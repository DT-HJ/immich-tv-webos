import {act, renderHook} from '@testing-library/react';
import type {TimelineAsset} from '../domain/types';
import {useMediaViewer} from './useMediaViewer';

const asset = (id: string): TimelineAsset => ({
	id,
	type: 'IMAGE',
	ratio: 1,
	localDateTime: '2026-07-01T12:00:00.000Z',
	durationSeconds: null,
});

describe('useMediaViewer', () => {
	test('keeps the same asset open when a newer page is prepended', () => {
		const initialAssets = [asset('b'), asset('c')];
		const {result, rerender} = renderHook(({assets}) => useMediaViewer(assets), {initialProps: {assets: initialAssets}});

		act(() => result.current.open('b'));
		expect(result.current.state).toEqual({assetId: 'b', assetIndex: 0});

		rerender({assets: [asset('a'), ...initialAssets]});
		expect(result.current.state).toEqual({assetId: 'b', assetIndex: 1});
	});
});

test('an asset opened by autoplay says so until the user pages away', () => {
	const assets = [asset('a'), asset('b'), asset('c')];
	const {result} = renderHook(() => useMediaViewer(assets));
	act(() => result.current.open('b', {autoplayed: true}));
	expect(result.current.state).toEqual({assetId: 'b', assetIndex: 1, autoplayed: true});
	act(() => result.current.navigate('next'));
	expect(result.current.state).toEqual({assetId: 'c', assetIndex: 2});
});
