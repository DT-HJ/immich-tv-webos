import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useWebOSKeys} from '../../hooks/useWebOSKeys';
import {useAutoHideControls} from '../../hooks/useAutoHideControls';
import {useAssetRotation} from '../../hooks/useAssetRotation';
import {useRepository} from '../../domain/RepositoryContext';
import {createSpotlightContainer, forceFocus, SpottableDiv} from '../../utils/spotlight';
import type {TimelineAsset} from '../../domain/types';
import {InfoPanel} from '../InfoPanel/InfoPanel';
import {MediaControls, ACTION_BAR_SPOTLIGHT_ID} from './MediaControls';
import {VideoPlayer, VideoPlayerApi} from './VideoPlayer';
import css from './MediaViewer.module.less';

interface MediaViewerProps {
	getAssetAt: (index: number) => TimelineAsset | null;
	totalCount: number;
	currentIndex: number;
	position: string;
	onClose: () => void;
	onNavigate: (direction: 'prev' | 'next') => void;
	onStartSlideshow: () => void;
	// A video played to its end: the grid moves on to the next video.
	onVideoEnded: () => void;
	// This video was opened by the previous one ending.
	autoplayed?: boolean;
}

const VIEWER_SPOTLIGHT_ID = 'media-viewer';
const STAGE_SPOTLIGHT_ID = 'media-viewer-stage';
// Trap Spotlight inside the viewer so D-pad can't reach the underlying rail/grid (which would
// trigger NavigationRail's focus-based expand and other surprises).
const ViewerContainer = createSpotlightContainer({enterTo: 'last-focused'});

// useWebOSKeys preventDefaults + stops propagation before calling the handler, so a no-op
// is enough to fully swallow a key (Spotlight never sees it → focus can't leak).
const swallowKey = () => {};
const focusStage = () => forceFocus(STAGE_SPOTLIGHT_ID);
const focusActionBar = () => forceFocus(ACTION_BAR_SPOTLIGHT_ID);
// How long the info overlay stays up on a video once it starts.
const VIDEO_INFO_FLASH_MS = 4000;
// Remote Play (webOS VK_PLAY) and the Play/Pause media key.
const PLAY_KEYCODES = new Set([415, 179]);
// Up opens the details panel, so on photos it no longer brings the chrome back.
const PHOTO_REVEAL_KEYS: ReadonlySet<string> = new Set(['Enter', 'ArrowDown']);

export const MediaViewer: React.FC<MediaViewerProps> = React.memo(({getAssetAt, totalCount, currentIndex, position, onClose, onNavigate, onStartSlideshow, onVideoEnded, autoplayed = false}) => {
	const repository = useRepository();
	const asset = getAssetAt(currentIndex);

	const handlePrev = useCallback(() => {
		if (currentIndex > 0) onNavigate('prev');
	}, [onNavigate, currentIndex]);

	const handleNext = useCallback(() => {
		if (currentIndex < totalCount - 1) onNavigate('next');
	}, [onNavigate, currentIndex, totalCount]);

	const isVideo = asset?.type === 'VIDEO';

	const [actionBarFocused, setActionBarFocused] = useState(false);
	const [rotation, rotate] = useAssetRotation(isVideo ? undefined : asset?.id);
	const controlsRef = useRef<HTMLDivElement>(null);

	// Auto-hide is for still images only: on video OK/Down belong to Sandstone's transport bar,
	// so the reveal keys can't be swallowed. Video derives its chrome below instead.
	const {visible: photoControlsVisible, show: showControls, hide: hideControls} = useAutoHideControls({
		enabled: !isVideo,
		controlsRef,
		revealKeys: PHOTO_REVEAL_KEYS,
	});
	// The details panel stays open while paging, following the asset on screen.
	const [infoOpen, setInfoOpen] = useState(false);
	const toggleInfo = useCallback(() => setInfoOpen((open) => !open), []);
	const inActionBar = !isVideo && photoControlsVisible && actionBarFocused;

	// The bar faded out under an idle focus: hand it back to the stage rather than leave it on
	// a hidden button.
	useEffect(() => {
		if (!photoControlsVisible && actionBarFocused) focusStage();
	}, [photoControlsVisible, actionBarFocused]);

	// Sandstone transport-bar visibility (video) drives arrow-key semantics: hidden →
	// left/right page between media; visible → Sandstone seeks.
	const playerApiRef = useRef<VideoPlayerApi | null>(null);
	const [videoControlsVisible, setVideoControlsVisible] = useState(false);
	// Sandstone bug: forwardCustom drops the documented {available} payload, so read the
	// current state through the imperative API instead (fires post-update, value is fresh).
	const handleVideoControlsAvailable = useCallback(({available}: {available?: boolean}) => {
		setVideoControlsVisible(available ?? playerApiRef.current?.areControlsVisible() ?? false);
	}, []);

	// Reset on media change: Sandstone doesn't notify when the player unmounts (video →
	// photo), which would leave the state stuck on "visible". State adjustment during
	// render, not in an effect (`react-hooks/set-state-in-effect`, Enact CI strict).
	const [prevAssetId, setPrevAssetId] = useState(asset?.id);
	// Bumped to (re)start the video info flash: on arrival, and on Up while the bar is closed.
	const [videoInfoFlash, setVideoInfoFlash] = useState(0);
	const [expiredVideoInfoFlash, setExpiredVideoInfoFlash] = useState(-1);
	if (asset?.id !== prevAssetId) {
		setPrevAssetId(asset?.id);
		setVideoControlsVisible(false);
		// The bar may unmount (photo → video) without a blur reaching us.
		setActionBarFocused(false);
		setVideoInfoFlash((n) => n + 1);
	}
	const videoControlsOpen = isVideo && videoControlsVisible;

	// The video chrome (date, position, paging arrows) used to stay on screen for the whole
	// playback. It now flashes on arrival and otherwise follows the transport bar.
	useEffect(() => {
		if (!isVideo) return undefined;
		const timer = window.setTimeout(() => setExpiredVideoInfoFlash(videoInfoFlash), VIDEO_INFO_FLASH_MS);
		return () => window.clearTimeout(timer);
	}, [isVideo, videoInfoFlash]);
	const videoInfoVisible = expiredVideoInfoFlash !== videoInfoFlash;
	const controlsVisible = isVideo ? videoControlsOpen || videoInfoVisible : photoControlsVisible;

	// Back closes the details panel, then the transport bar if open, then the viewer. Our Back
	// bridge (capture + stopImmediatePropagation) preempts Sandstone's Cancelable, so the
	// step-by-step behavior has to be restored here.
	const handleBack = useCallback(() => {
		if (infoOpen) {
			setInfoOpen(false);
			return;
		}
		if (videoControlsOpen && playerApiRef.current) {
			playerApiRef.current.hideControls();
			return;
		}
		onClose();
	}, [infoOpen, videoControlsOpen, onClose]);

	useWebOSKeys({
		onBack: handleBack,
		// Left/right page between media, except inside the action bar (Spotlight moves between
		// its buttons) and while the video transport bar is open (Sandstone seeks).
		onArrowLeft: videoControlsOpen || inActionBar ? undefined : handlePrev,
		onArrowRight: videoControlsOpen || inActionBar ? undefined : handleNext,
		// Up/down must never reach Spotlight unhandled, or it leaks focus to the grid behind the
		// overlay. Unassigned here, they are reveal keys (useAutoHideControls) or belong to the
		// Sandstone video bar.
		onArrowUp: isVideo ? (videoControlsOpen ? undefined : toggleInfo) : inActionBar ? focusStage : toggleInfo,
		onArrowDown: isVideo ? undefined : inActionBar ? swallowKey : controlsVisible ? focusActionBar : undefined,
	});

	// The remote's Play starts a slideshow from a photo (on a video it is the player's).
	useEffect(() => {
		if (isVideo) return undefined;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (!PLAY_KEYCODES.has(event.keyCode)) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			onStartSlideshow();
		};
		window.addEventListener('keydown', handleKeyDown, {capture: true});
		return () => window.removeEventListener('keydown', handleKeyDown, {capture: true});
	}, [isVideo, onStartSlideshow]);

	// Photos rest focus on the stage; forcing it also pulls focus off the grid card behind the
	// overlay when the viewer was opened with the pointer.
	useEffect(() => {
		forceFocus(isVideo ? VIEWER_SPOTLIGHT_ID : STAGE_SPOTLIGHT_ID);
	}, [isVideo]);

	const handleStageClick = controlsVisible ? hideControls : showControls;

	useEffect(() => {
		const prefetch = (index: number) => {
			const neighbor = getAssetAt(index);
			if (!neighbor || neighbor.type === 'VIDEO') return;
			const img = new Image();
			img.src = repository.previewUrl(neighbor.id);
		};
		prefetch(currentIndex - 1);
		prefetch(currentIndex + 1);
	}, [currentIndex, getAssetAt, repository]);

	if (!asset) return null;

	const mediaUrl = isVideo ? repository.videoPlaybackUrl(asset.id) : repository.previewUrl(asset.id);

	return (
		<ViewerContainer spotlightId={VIEWER_SPOTLIGHT_ID} spotlightRestrict="self-only" className={css.viewerOverlay}>
			{/* The media and its chrome share the area left of the details panel. */}
			<div className={css.stageArea}>
				<div className={css.viewerContent}>
					{isVideo ? (
						<VideoPlayer src={mediaUrl} onControlsAvailable={handleVideoControlsAvailable} onEnded={onVideoEnded} apiRef={playerApiRef} />
					) : (
						<img
							src={mediaUrl}
							alt=""
							className={rotation % 180 ? `${css.photo} ${css.quarterTurn}` : css.photo}
							style={rotation ? {transform: `rotate(${rotation}deg)`} : undefined}
						/>
					)}
				</div>
				{!isVideo && <SpottableDiv spotlightId={STAGE_SPOTLIGHT_ID} className={css.stage} onClick={handleStageClick} />}
				<MediaControls
					rootRef={controlsRef}
					asset={asset}
					position={position}
					isVideo={isVideo}
					controlsVisible={controlsVisible}
					infoOpen={infoOpen}
					autoplayed={isVideo && autoplayed}
					canGoPrev={currentIndex > 0}
					canGoNext={currentIndex < totalCount - 1}
					onPrev={handlePrev}
					onNext={handleNext}
					onClose={onClose}
					onRotate={rotate}
					onStartSlideshow={onStartSlideshow}
					onToggleInfo={toggleInfo}
					onActionBarFocusChange={setActionBarFocused}
				/>
			</div>
			{infoOpen && <InfoPanel asset={asset} />}
		</ViewerContainer>
	);
});

MediaViewer.displayName = 'MediaViewer';
