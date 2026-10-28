// Smart search runs on the server's CLIP model; the stock one (ViT-B-32 openai) only reads
// English. Suggested searches carry an English query behind a localized label, and typed Korean
// words are looked up here so "바다" searches for "beach".

export interface SearchTerm {
	// What the user sees (and typed, for a typed search).
	label: string;
	// What the server is asked.
	query: string;
}

interface Suggestion {
	ko: string;
	en: string;
	query: string;
}

const SUGGESTIONS: Suggestion[] = [
	{ko: '바다', en: 'Beach', query: 'beach'},
	{ko: '노을', en: 'Sunset', query: 'sunset'},
	{ko: '산', en: 'Mountains', query: 'mountains'},
	{ko: '꽃', en: 'Flowers', query: 'flowers'},
	{ko: '눈', en: 'Snow', query: 'snow'},
	{ko: '음식', en: 'Food', query: 'food'},
	{ko: '생일 케이크', en: 'Birthday cake', query: 'birthday cake'},
	{ko: '놀이터', en: 'Playground', query: 'playground'},
	{ko: '수영장', en: 'Swimming pool', query: 'swimming pool'},
	{ko: '공원', en: 'Park', query: 'park'},
	{ko: '동물원', en: 'Zoo', query: 'zoo animals'},
	{ko: '강아지', en: 'Dog', query: 'dog'},
	{ko: '고양이', en: 'Cat', query: 'cat'},
	{ko: '야경', en: 'City at night', query: 'city at night'},
	{ko: '불꽃놀이', en: 'Fireworks', query: 'fireworks'},
	{ko: '크리스마스', en: 'Christmas', query: 'christmas tree'},
	{ko: '단풍', en: 'Autumn leaves', query: 'autumn leaves'},
	{ko: '벚꽃', en: 'Cherry blossoms', query: 'cherry blossoms'},
	{ko: '캠핑', en: 'Camping', query: 'camping tent'},
	{ko: '자동차', en: 'Car', query: 'car'},
	{ko: '비행기', en: 'Airplane', query: 'airplane'},
];

// Typed words beyond the suggestions. Single words only: a phrase is looked up word by word.
const WORDS: Record<string, string> = {
	해변: 'beach',
	바닷가: 'beach',
	하늘: 'sky',
	구름: 'clouds',
	나무: 'tree',
	숲: 'forest',
	강: 'river',
	호수: 'lake',
	폭포: 'waterfall',
	다리: 'bridge',
	집: 'house',
	거실: 'living room',
	부엌: 'kitchen',
	침대: 'bed',
	책: 'book',
	장난감: 'toys',
	인형: 'doll',
	자전거: 'bicycle',
	유모차: 'stroller',
	기차: 'train',
	버스: 'bus',
	배: 'boat',
	카페: 'cafe',
	커피: 'coffee',
	빵: 'bread',
	피자: 'pizza',
	국수: 'noodles',
	라면: 'ramen',
	고기: 'meat',
	과일: 'fruit',
	수박: 'watermelon',
	딸기: 'strawberry',
	아이스크림: 'ice cream',
	케이크: 'cake',
	생일: 'birthday',
	풍선: 'balloons',
	눈사람: 'snowman',
	비: 'rain',
	우산: 'umbrella',
	모자: 'hat',
	아기: 'baby',
	아이: 'child',
	가족: 'family',
	엄마: 'mother',
	아빠: 'father',
	할머니: 'grandmother',
	할아버지: 'grandfather',
	친구: 'friends',
	결혼식: 'wedding',
	여행: 'travel',
	호텔: 'hotel',
	수영: 'swimming',
	축구: 'soccer',
	야구: 'baseball',
	그림: 'drawing',
	웃음: 'smiling',
	잠: 'sleeping',
	셀카: 'selfie',
	단체사진: 'group photo',
	스크린샷: 'screenshot',
	문서: 'document',
	영수증: 'receipt',
	밤: 'night',
	겨울: 'winter',
	여름: 'summer',
	봄: 'spring',
	가을: 'autumn',
};

const HANGUL = /[가-힣ㄱ-ㆎ]/;

/** The suggested searches, labelled in the UI language. */
export function suggestedTerms(language: 'en' | 'ko'): SearchTerm[] {
	return SUGGESTIONS.map((s) => ({label: language === 'ko' ? s.ko : s.en, query: s.query}));
}

/**
 * A typed search: Korean words the lists know become their English query; anything else is
 * sent as typed (a word the model can't read still gets the closest images it can find).
 */
export function termFromInput(input: string): SearchTerm | null {
	const label = input.replace(/\s+/g, ' ').trim();
	if (!label) return null;
	if (!HANGUL.test(label)) return {label, query: label};
	const whole = SUGGESTIONS.find((s) => s.ko === label);
	if (whole) return {label, query: whole.query};
	const words = label.split(' ').map((word) => {
		const suggestion = SUGGESTIONS.find((s) => s.ko === word);
		return suggestion ? suggestion.query : WORDS[word] ?? word;
	});
	return {label, query: words.join(' ')};
}

const RECENT_LIMIT = 8;

/** Recent searches, newest first, one entry per label. */
export function addRecent(recent: readonly SearchTerm[], term: SearchTerm): SearchTerm[] {
	return [term, ...recent.filter((r) => r.label !== term.label)].slice(0, RECENT_LIMIT);
}

export function parseRecent(raw: unknown): SearchTerm[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.filter((r): r is SearchTerm => !!r && typeof r === 'object' && typeof (r as SearchTerm).label === 'string' && typeof (r as SearchTerm).query === 'string')
		.slice(0, RECENT_LIMIT)
		.map((r) => ({label: r.label, query: r.query}));
}
