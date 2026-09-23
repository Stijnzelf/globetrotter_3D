import { TEXTS } from './i18n.js';
import { TOTAL_ROUNDS, eligibleCountries, shuffle, practiceQueue, pointsFor, qualifies, focusAltitude } from './game-rules.js';

const $ = id => document.getElementById(id);
const STORE = 'globetrotter_v4_scores';
const PROGRESS = 'globetrotter_v4_progress';
let lang = 'nl', countries = [], byId = new Map(), globe, queue = [];
let mode = 'classic', difficulty = 'easy', target = null, round = 0, score = 0;
let correctCount = 0, streak = 0, status = {}, lastAnswer = null, ready = false;
let dragStart = [0, 0], audioCtx;
const tr = key => TEXTS[lang][key] || key;
const nameOf = country => country?.name?.[lang] || country?.name?.en || '';
const capitalOf = country => country.capital[lang];
const key = () => `${mode}:${difficulty}`;

function storageRead(name, fallback) {
    try { return JSON.parse(localStorage.getItem(name)) || fallback; }
    catch { return fallback; }
}
function storageWrite(name, value) {
    try { localStorage.setItem(name, JSON.stringify(value)); } catch { /* Private mode. */ }
}
const allScores = () => storageRead(STORE, {});
const categoryScores = () => (allScores()[key()] || []).filter(s => Number.isFinite(s.score));

function staticTexts() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tr(el.dataset.i18n); });
    $('leaderboardCategory').textContent = `${tr('leaderboard_category')}: ${mode === 'learn' ? tr('learn_score') : tr('mode_' + (mode === 'classic' ? 'countries' : mode)) + ' · ' + tr('lvl_' + difficulty)}`;
    $('scoreSourceBadge').textContent = tr('local');
    if (!ready) $('startupStatus').textContent = tr('loading_countries');
}

window.setLanguage = function (value) {
    if (!TEXTS[value]) return;
    lang = value;
    $('langNL').classList.toggle('active', lang === 'nl');
    $('langEN').classList.toggle('active', lang === 'en');
    staticTexts();
    if (target) questionUI();
    if (lastAnswer) resultUI(lastAnswer);
    renderLeaderboard();
};

function renderLeaderboard() {
    const list = $('leaderboardList');
    list.replaceChildren();
    const scores = mode === 'learn' ? [] : categoryScores();
    if (!scores.length) {
        const empty = document.createElement('div');
        empty.className = 'text-center text-gray-500 text-xs py-4';
        empty.textContent = tr('no_scores');
        list.append(empty);
        return;
    }
    scores.slice(0, 10).forEach((entry, index) => {
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center bg-white/10 px-3 py-2 rounded-lg border border-white/5';
        const identity = document.createElement('div');
        identity.className = 'flex gap-3 items-center min-w-0';
        const rank = document.createElement('span');
        rank.className = 'text-yellow-500 font-black w-4 text-xs';
        rank.textContent = `${index + 1}.`;
        const name = document.createElement('span');
        name.className = 'font-bold text-white text-xs truncate max-w-[150px]';
        name.textContent = String(entry.name).slice(0, 12);
        identity.append(rank, name);
        const points = document.createElement('span');
        points.className = 'text-yellow-400 font-mono text-xs font-bold';
        points.textContent = String(entry.score);
        row.append(identity, points);
        list.append(row);
    });
}

function countryColor(feature, hovered = null) {
    const state = status[feature.properties.id];
    if (state === 'correct' || state === 'target') return '#22c55e';
    if (state === 'wrong') return '#ef4444';
    return feature === hovered ? 'rgba(255,255,255,0.25)' : 'rgba(200,250,255,0.1)';
}
function refreshMap() {
    globe?.polygonCapColor(feature => countryColor(feature));
    globe?.pointColor(point => status[point.id] === 'target' || status[point.id] === 'correct' ? '#22c55e' : status[point.id] === 'wrong' ? '#ef4444' : '#ffd166');
}

function initGlobe(map) {
    if (typeof Globe === 'undefined') throw new Error('Globe.gl unavailable');
    const container = $('globeViz');
    container.addEventListener('pointerdown', event => { dragStart = [event.clientX, event.clientY]; });
    globe = Globe()
        .width(innerWidth).height(innerHeight)
        .backgroundColor('#000011')
        .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
        .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
        .pointOfView({ lat: 20, lng: 0, altitude: 2.5 })
        .polygonLabel(() => '')
        .polygonCapColor(feature => countryColor(feature))
        .polygonSideColor(() => 'rgba(0,50,80,0.3)')
        .polygonStrokeColor(() => '#5599ff')
        .polygonsData(map.features)
        .onPolygonHover(hovered => {
            globe.polygonAltitude(feature => feature === hovered ? 0.04 : 0.01);
            globe.polygonCapColor(feature => countryColor(feature, hovered));
        })
        .onPolygonClick((feature, event) => handleSelection(feature.properties.id, feature.properties.name, event))
        .pointLat(point => point.focus[0])
        .pointLng(point => point.focus[1])
        .pointRadius(1.15)
        .pointAltitude(0.012)
        .pointLabel(() => '')
        .pointColor(() => '#ffd166')
        .pointsData(countries.filter(country => country.marker).map(country => ({ id: country.iso3, focus: country.focus })))
        .onPointClick((point, event) => handleSelection(point.id, nameOf(byId.get(point.id)), event))(container);
    addEventListener('resize', () => { globe.width(innerWidth).height(innerHeight); });
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.5;
}

function zoom(multiplier) {
    if (!globe) return;
    const view = globe.pointOfView();
    globe.pointOfView({ lat: view.lat, lng: view.lng, altitude: Math.max(0.12, Math.min(3.5, view.altitude * multiplier)) }, 350);
}

function chooseMode(value) {
    if (!ready) return;
    mode = value;
    if (value === 'learn') {
        difficulty = 'exam';
        startGame('exam');
    } else {
        $('modeSelection').classList.add('hidden');
        $('difficultySelection').classList.remove('hidden');
        staticTexts();
        renderLeaderboard();
    }
}

function startGame(value) {
    if (!ready) return;
    difficulty = value;
    const pool = eligibleCountries(countries, value);
    queue = mode === 'learn' ? practiceQueue(pool, storageRead(PROGRESS, {})) : shuffle(pool).slice(0, TOTAL_ROUNDS);
    if (queue.length < TOTAL_ROUNDS) return;
    score = round = correctCount = streak = 0;
    status = {}; lastAnswer = null; target = null;
    $('scoreDisplay').textContent = '0';
    updateStreak();
    $('startScreen').classList.add('hidden');
    staticTexts();
    initAudio();
    nextRound();
}

function nextRound() {
    $('resultBar').classList.add('hidden');
    status = {}; lastAnswer = null;
    refreshMap();
    if (globe) globe.controls().autoRotate = true;
    if (round >= TOTAL_ROUNDS) { endGame(); return; }
    $('questionCard').classList.remove('hidden');
    target = queue.shift();
    round++;
    $('roundDisplay').textContent = String(round);
    questionUI();
}

function questionUI() {
    $('targetFlag').textContent = String.fromCodePoint(...target.iso2.toUpperCase().split('').map(c => c.charCodeAt(0) + 127397));
    $('targetName').textContent = nameOf(target);
    $('targetCapital').textContent = capitalOf(target);
    $('flagContainer').style.display = mode === 'capitals' ? 'none' : 'flex';
    $('targetName').style.display = mode === 'flags' || mode === 'capitals' ? 'none' : 'block';
    $('capitalWrapper').style.display = mode === 'flags' ? 'none' : 'block';
    $('targetCapital').className = mode === 'capitals' ? 'text-2xl font-black text-blue-700 block mt-2' : 'text-blue-700 text-sm font-bold';
    $('instructionLabel').textContent = tr(mode === 'flags' ? 'what_country' : mode === 'capitals' ? 'where_city' : 'search_country');
}

function handleSelection(id, mapName, event) {
    if (!target || !$('endScreen').classList.contains('hidden') || !$('resultBar').classList.contains('hidden')) return;
    if (event && Math.hypot(event.clientX - dragStart[0], event.clientY - dragStart[1]) > 10) return;
    globe.controls().autoRotate = false;
    const correct = id === target.iso3;
    if (correct) {
        correctCount++;
        streak++;
        score += pointsFor(difficulty, streak);
        status[id] = 'correct';
        playSound('success');
        if (typeof confetti === 'function') confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 } });
    } else {
        streak = 0;
        if (id) status[id] = 'wrong';
        status[target.iso3] = 'target';
        playSound('wrong');
        const [lat, lng] = target.focus;
        if (Number.isFinite(lat) && Number.isFinite(lng)) globe.pointOfView({ lat, lng, altitude: focusAltitude(target.areaKm2) }, 1500);
    }
    if (mode === 'learn') {
        const progress = storageRead(PROGRESS, {});
        const entry = progress[target.iso3] || { seen: 0, correct: 0, wrong: 0 };
        entry.seen++;
        entry[correct ? 'correct' : 'wrong']++;
        progress[target.iso3] = entry;
        storageWrite(PROGRESS, progress);
    }
    $('scoreDisplay').textContent = String(score);
    updateStreak();
    refreshMap();
    lastAnswer = { correct, clickedId: id, mapName };
    resultUI(lastAnswer);
}

function updateStreak() {
    $('streakBadge').classList.toggle('hidden', streak < 3);
    $('streakCount').textContent = String(streak);
}

function resultUI(answer) {
    $('questionCard').classList.add('hidden');
    $('resultBar').classList.remove('hidden');
    $('resultContent').className = `rounded-3xl shadow-2xl p-4 border-b-8 flex items-center justify-between gap-4 ${answer.correct ? 'bg-green-100 text-green-900 border-green-400' : 'bg-red-100 text-red-900 border-red-300'}`;
    $('resultTitle').textContent = tr(answer.correct ? 'good_job' : 'too_bad');
    const sub = $('resultSub');
    sub.replaceChildren();
    if (answer.correct) {
        sub.textContent = `${nameOf(target)} ${tr('found')}${streak >= 3 ? ' ' + tr('bonus_streak') : ''}`;
    } else {
        const clicked = byId.get(answer.clickedId);
        sub.append(`${tr('clicked_on')} `);
        const strong = document.createElement('strong');
        strong.textContent = clicked ? nameOf(clicked) : answer.mapName;
        sub.append(strong, `. ${tr('green_is')} ${nameOf(target)}.`);
    }
}

function endGame() {
    $('questionCard').classList.add('hidden');
    $('endScreen').classList.remove('hidden');
    if (correctCount === TOTAL_ROUNDS) {
        score += 50;
        $('scoreDisplay').textContent = String(score);
    }
    if (correctCount >= 8) playSound('win');
    $('finalScore').textContent = String(score);
    $('finalCorrectCount').textContent = `${correctCount} / ${TOTAL_ROUNDS}`;
    const eligible = mode !== 'learn' && qualifies(categoryScores(), score);
    $('highScoreInputArea').classList.toggle('hidden', !eligible);
    $('restartBtn').classList.toggle('hidden', eligible);
}

function saveScore() {
    if ($('highScoreInputArea').classList.contains('hidden')) return;
    const name = $('playerNameInput').value.trim().slice(0, 12) || tr('anonymous');
    const scores = allScores();
    scores[key()] = [...categoryScores(), { name, score }].sort((a, b) => b.score - a.score).slice(0, 10);
    storageWrite(STORE, scores);
    renderLeaderboard();
    $('highScoreInputArea').classList.add('hidden');
    $('restartBtn').classList.remove('hidden');
}

function fullReset() {
    $('endScreen').classList.add('hidden');
    $('startScreen').classList.remove('hidden');
    $('questionCard').classList.add('hidden');
    $('resultBar').classList.add('hidden');
    $('highScoreInputArea').classList.add('hidden');
    $('restartBtn').classList.remove('hidden');
    $('playerNameInput').value = '';
    score = round = correctCount = streak = 0;
    target = lastAnswer = null;
    status = {};
    $('scoreDisplay').textContent = '0';
    $('roundDisplay').textContent = '1';
    updateStreak();
    refreshMap();
    if (globe) {
        globe.controls().autoRotate = true;
        globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 1000);
    }
    mode = 'classic'; difficulty = 'easy';
    $('modeSelection').classList.remove('hidden');
    $('difficultySelection').classList.add('hidden');
    staticTexts();
    renderLeaderboard();
}

function initAudio() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx && Audio) audioCtx = new Audio();
    audioCtx?.resume?.();
}
function playSound(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.frequency.value = type === 'wrong' ? 160 : type === 'win' ? 800 : 620;
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + 0.25);
}

async function init() {
    $('btnClassic').onclick = () => chooseMode('classic');
    $('btnFlags').onclick = () => chooseMode('flags');
    $('btnCapitals').onclick = () => chooseMode('capitals');
    $('btnLearn').onclick = () => chooseMode('learn');
    for (const level of ['Easy', 'Medium', 'Hard', 'Exam']) $('btn' + level).onclick = () => startGame(level.toLowerCase());
    $('btnBack').onclick = () => { $('modeSelection').classList.remove('hidden'); $('difficultySelection').classList.add('hidden'); };
    $('nextBtn').onclick = nextRound;
    $('restartBtn').onclick = fullReset;
    $('btnSaveScore').onclick = saveScore;
    $('btnSkipScore').onclick = () => {
        $('highScoreInputArea').classList.add('hidden');
        $('restartBtn').classList.remove('hidden');
    };
    $('zoomIn').onclick = () => zoom(0.65);
    $('zoomOut').onclick = () => zoom(1.5);
    staticTexts(); renderLeaderboard();
    try {
        const [countryResponse, mapResponse] = await Promise.all([fetch('./data/countries.json'), fetch('./data/world-50m.geojson')]);
        if (!countryResponse.ok || !mapResponse.ok) throw new Error('Map response failed');
        const [data, map] = await Promise.all([countryResponse.json(), mapResponse.json()]);
        if (data.length !== 195 || !Array.isArray(map.features)) throw new Error('Incomplete map data');
        countries = data;
        byId = new Map(countries.map(country => [country.iso3, country]));
        initGlobe(map);
        ready = true;
        $('startupStatus').classList.add('hidden');
        $('loadingMsg').classList.add('hidden');
    } catch (error) {
        console.error('Game initialization failed:', error);
        $('startupStatus').textContent = tr('data_error');
        $('loadingMsg').textContent = tr('data_error');
    }
}

init();
