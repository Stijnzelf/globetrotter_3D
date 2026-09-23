export const TOTAL_ROUNDS = 10;

export function eligibleCountries(countries, difficulty) {
    const maxTier = { easy: 1, medium: 2, hard: 3, exam: 3 }[difficulty];
    if (!maxTier) throw new Error(`Unknown difficulty: ${difficulty}`);
    return countries.filter(country => country.difficulty <= maxTier);
}

export function shuffle(items, random = Math.random) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// Practice favours unseen countries and prior mistakes, with no repeats in a round.
export function practiceQueue(countries, progress, count = TOTAL_ROUNDS, random = Math.random) {
    const weighted = countries.map(country => {
        const p = progress[country.iso3] || { seen: 0, correct: 0, wrong: 0 };
        const weight = p.seen === 0 ? 5 : Math.max(1, 3 + 2 * p.wrong - p.correct);
        return { country, key: -Math.log(Math.max(Number.MIN_VALUE, random())) / weight };
    });
    return weighted.sort((a, b) => a.key - b.key).slice(0, count).map(item => item.country);
}

export function pointsFor(difficulty, streak) {
    return ({ easy: 10, medium: 12, hard: 15, exam: 15 })[difficulty] + (streak >= 3 ? 5 : 0);
}

export function qualifies(scores, score) {
    return score > 0 && (scores.length < 10 || score > scores[9].score);
}

export function focusAltitude(area) {
    if (area > 2_000_000) return 2.1;
    if (area > 100_000) return 1.2;
    if (area > 10_000) return 0.8;
    if (area > 1000) return 0.5;
    return 0.28;
}
