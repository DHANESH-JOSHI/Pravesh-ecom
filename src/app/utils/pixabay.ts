import config from '@/config';
import { logger } from '@/config/logger';
import { ICategory } from '@/modules/category/category.interface';
const API_KEY = config.PIXABAY_API_KEY;
const API_URL = 'https://pixabay.com/api/'

export interface PixabayHit {
  id: number;
  tags: string;
  pageURL: string;
  previewURL: string;
  webformatURL: string;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  likes: number;
  downloads: number;
  views: number;
  user: string;
}

interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayHit[];
}

function buildQuery(title: string, pathSegments: string[] = []): string {
  const base = title
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const cleanedSegments = pathSegments
    .filter(s => s && s.trim().length > 0)
    .map(s =>
      s
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
    )
    .slice(0, 4)
    .filter(seg => seg !== base);

  const composite = [base, ...cleanedSegments].join(' ');
  return composite.replace(/\s+/g, ' ').trim();
}

function pickBest(hits: PixabayHit[]): PixabayHit | null {
  if (!hits.length) return null;
  return hits
    .slice()
    .sort((a, b) => {
      const scoreA = a.likes * 3 + a.downloads + a.views * 0.1;
      const scoreB = b.likes * 3 + b.downloads + b.views * 0.1;
      return scoreB - scoreA;
    })[0];
}

export async function getPixabayImageForCategory(title: string, pathSegments: string[] = []): Promise<string | null> {
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
      logger.error(`[PIXABAY] Non-OK response (${res.status}) for query="${q}"`);
      return null;
    }
    const data = (await res.json()) as PixabayResponse;
    const best = pickBest(data.hits || []);
    const chosen = best?.largeImageURL || best?.webformatURL || null;
    if (chosen) {
      logger.info(`[PIXABAY] Selected image for "${title}" -> ${chosen}`);
    } else {
      logger.info(`[PIXABAY] No image found for "${title}"`);
    }
    return chosen;
  } catch (err: any) {
    logger.error(`[PIXABAY] Fetch error for "${title}": ${err.message}`);
    return null;
  }
}

export async function attachAutoImage(category: ICategory): Promise<void> {
  const img = await getPixabayImageForCategory(category.title, category.path || []);
  if (img) {
    category.image = img;
  }
}