import {fireEvent, renderHook} from '@testing-library/react';
import {useRootBack, useWebOSKeys} from './useWebOSKeys';

// Fire a keydown while a single onBack is mounted, and report whether it was treated as Back.
function firesBack(init: KeyboardEventInit & {keyCode?: number}): boolean {
	const onBack = jest.fn();
	const {unmount} = renderHook(() => useWebOSKeys({onBack}));
	fireEvent.keyDown(window, init);
	unmount();
	return onBack.mock.calls.length > 0;
}

describe('useWebOSKeys Back detection', () => {
	test('real Back button (key "GoBack") triggers back on any paired keyCode', () => {
		expect(firesBack({key: 'GoBack', keyCode: 461})).toBe(true);
		expect(firesBack({key: 'GoBack', keyCode: 1536})).toBe(true);
	});

	test('legacy/cross-platform numeric Back codes still trigger back', () => {
		expect(firesBack({keyCode: 461})).toBe(true);
		expect(firesBack({keyCode: 1536})).toBe(true); // webOS 10.x Back, no key set
		expect(firesBack({keyCode: 10009})).toBe(true);
		expect(firesBack({keyCode: 27})).toBe(true);
	});

	// Regression: the LG magic-remote scroll wheel emits keyCode 1536 with key 'Unidentified'
	// while scrolling in 5-way mode. That must not be read as Back, or a scroll pops the view
	// (album/viewer exited mid-scroll on device).
	test('magic-remote wheel scroll (keyCode 1536 + key "Unidentified") does NOT trigger back', () => {
		expect(firesBack({keyCode: 1536, key: 'Unidentified'})).toBe(false);
	});

	test('the wheel filter is scoped to 1536 only — other Back codes still fire even if key is "Unidentified"', () => {
		expect(firesBack({keyCode: 461, key: 'Unidentified'})).toBe(true);
	});
});

describe('useRootBack', () => {
	const pressBack = () => {
		const event = new KeyboardEvent('keydown', {key: 'GoBack', keyCode: 461, cancelable: true} as KeyboardEventInit);
		window.dispatchEvent(event);
		return event.defaultPrevented;
	};

	test('is consulted only when no screen takes Back, and can leave the key to the system', () => {
		let handles = true;
		const root = jest.fn(() => handles);
		const {unmount: unmountRoot} = renderHook(() => useRootBack(root));

		const onBack = jest.fn();
		const {unmount: unmountScreen} = renderHook(() => useWebOSKeys({onBack}));
		expect(pressBack()).toBe(true);
		expect(onBack).toHaveBeenCalledTimes(1);
		expect(root).not.toHaveBeenCalled();

		unmountScreen();
		expect(pressBack()).toBe(true);
		expect(root).toHaveBeenCalledTimes(1);

		// Declined (focus already on the menu): WAM gets the key and shows its exit prompt.
		handles = false;
		expect(pressBack()).toBe(false);
		unmountRoot();
		expect(pressBack()).toBe(false);
		expect(root).toHaveBeenCalledTimes(2);
	});

	test('a re-rendered root handler stays below screens mounted after it', () => {
		const first = jest.fn(() => true);
		const second = jest.fn(() => true);
		const {rerender, unmount} = renderHook(({handler}) => useRootBack(handler), {initialProps: {handler: first}});
		const onBack = jest.fn();
		const view = renderHook(() => useWebOSKeys({onBack}));
		rerender({handler: second});
		pressBack();
		expect(onBack).toHaveBeenCalledTimes(1);
		view.unmount();
		pressBack();
		expect(second).toHaveBeenCalledTimes(1);
		expect(first).not.toHaveBeenCalled();
		unmount();
	});
});
