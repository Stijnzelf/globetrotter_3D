import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligibleCountries, practiceQueue, pointsFor, qualifies, focusAltitude } from '../game-rules.js';

const countries = JSON.parse(readFileSync(new URL('../data/countries.json', import.meta.url)));
const map = JSON.parse(readFileSync(new URL('../data/world-50m.geojson', import.meta.url)));
const codes = new Set(countries.map(c => c.iso3));

test('195 unique states including both UN observers, each with bilingual data', () => {
    assert.equal(countries.length, 195);
    assert.equal(codes.size, 195);
    assert.equal(new Set(countries.map(c => c.iso2)).size, 195);
    assert.ok(codes.has('VAT') && codes.has('PSE'));
    for (const c of countries) {
        assert.match(c.iso2, /^[a-z]{2}$/);
        assert.match(c.iso3, /^[A-Z]{3}$/);
        assert.ok([1, 2, 3].includes(c.difficulty));
        assert.ok(c.name.nl && c.name.en && c.capital.nl && c.capital.en && c.continent);
        assert.ok(c.focus[0] >= -90 && c.focus[0] <= 90);
        assert.ok(c.focus[1] >= -180 && c.focus[1] <= 180);
        assert.ok(c.areaKm2 > 0);
    }
});

test('every country is selectable via geometry; small states have markers', () => {
    const mapped = new Set(map.features.map(f => f.properties.id).filter(Boolean));
    assert.deepEqual(mapped, codes);
    assert.ok(countries.filter(c => c.marker).length >= 30);
    for (const f of map.features) {
        assert.ok(f.properties.id === null || codes.has(f.properties.id));
        assert.ok(f.properties.name);
        assert.ok(['Polygon', 'MultiPolygon'].includes(f.geometry.type));
        assert.ok(f.geometry.coordinates.length);
    }
    assert.equal(map.features.find(f => f.properties.name === 'France').properties.id, 'FRA');
    assert.equal(map.features.find(f => f.properties.name === 'Norway').properties.id, 'NOR');
    assert.equal(map.features.find(f => f.properties.name === 'Palestine').properties.id, 'PSE');
    assert.equal(map.features.find(f => f.properties.name === 'South Sudan').properties.id, 'SSD');
});

test('cumulative tiers, separate scoring and high-score threshold', () => {
    const easy = eligibleCountries(countries, 'easy');
    const medium = eligibleCountries(countries, 'medium');
    const hard = eligibleCountries(countries, 'hard');
    assert.equal(easy.length, 22);
    assert.equal(medium.length, 54);
    assert.equal(hard.length, 195);
    assert.deepEqual(eligibleCountries(countries, 'exam'), hard);
    assert.ok(easy.every(c => medium.includes(c)));
    assert.equal(pointsFor('medium', 3), 17);
    assert.equal(focusAltitude(10), 0.28);
    assert.equal(qualifies([], 0), false);
    assert.equal(qualifies([], 10), true);
    assert.equal(qualifies(Array.from({ length: 10 }, () => ({ score: 100 })), 100), false);
});

test('practice chooses unique countries and prioritizes mistakes', () => {
    const subset = countries.slice(0, 10);
    const progress = Object.fromEntries(subset.map(c => [c.iso3, { seen: 5, correct: 5, wrong: 0 }]));
    const problem = subset[0];
    progress[problem.iso3] = { seen: 5, correct: 0, wrong: 5 };
    const queue = practiceQueue(subset, progress, 5, () => 0.5);
    assert.equal(new Set(queue.map(c => c.iso3)).size, 5);
    assert.equal(queue[0].iso3, problem.iso3);
});
