"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPixabayImageForCategory = getPixabayImageForCategory;
exports.attachAutoImage = attachAutoImage;
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../config/logger");
const API_KEY = config_1.default.PIXABAY_API_KEY;
const API_URL = 'https://pixabay.com/api/';
function buildQuery(title, pathSegments = []) {
    const base = title
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    const cleanedSegments = pathSegments
        .filter(s => s && s.trim().length > 0)
        .map(s => s
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase())
        .slice(0, 4)
        .filter(seg => seg !== base);
    const composite = [base, ...cleanedSegments].join(' ');
    return composite.replace(/\s+/g, ' ').trim();
}
function pickBest(hits) {
    if (!hits.length)
        return null;
    return hits
        .slice()
        .sort((a, b) => {
        const scoreA = a.likes * 3 + a.downloads + a.views * 0.1;
        const scoreB = b.likes * 3 + b.downloads + b.views * 0.1;
        return scoreB - scoreA;
    })[0];
}
async function getPixabayImageForCategory(title, pathSegments = []) {
    const q = buildQuery(title, pathSegments);
    const url = new URL(API_URL);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('q', q);
    url.searchParams.set('image_type', 'photo');
    url.searchParams.set('per_page', '10');
    url.searchParams.set('safesearch', 'true');
    try {
        const res = await fetch(url.toString(), { method: 'GET' });
        if (!res.ok) {
            logger_1.logger.error(`[PIXABAY] Non-OK response (${res.status}) for query="${q}"`);
            return null;
        }
        const data = (await res.json());
        const best = pickBest(data.hits || []);
        const chosen = best?.largeImageURL || best?.webformatURL || null;
        if (chosen) {
            logger_1.logger.info(`[PIXABAY] Selected image for "${title}" -> ${chosen}`);
        }
        else {
            logger_1.logger.info(`[PIXABAY] No image found for "${title}"`);
        }
        return chosen;
    }
    catch (err) {
        logger_1.logger.error(`[PIXABAY] Fetch error for "${title}": ${err.message}`);
        return null;
    }
}
async function attachAutoImage(category) {
    const img = await getPixabayImageForCategory(category.title, category.path || []);
    if (img) {
        category.image = img;
    }
}
//# sourceMappingURL=pixabay.js.map