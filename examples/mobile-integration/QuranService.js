/**
 * QuranService - Mobile-optimized Quran data service for Islamic apps
 * Features: Priority loading, smart caching, offline support, compression
 */

class QuranService {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'https://cdn.jsdelivr.net/gh/username/islamic-data@main';
    this.cache = new Map();
    this.storage = config.storage || localStorage; // or AsyncStorage for React Native
    this.compressionEnabled = config.compression !== false;
    this.offlineFirst = config.offlineFirst !== false;

    // Loading priorities based on common reading patterns
    this.loadingPriority = {
      1: [1, 67, 112, 113, 114], // Fatihah, Mulk, Ikhlas, Falaq, Nas
      2: [18, 19, 20, 36, 48, 55, 56, 62, 78, 97], // Kahf, Maryam, etc.
      3: 'remaining'
    };
  }

  /**
   * Initialize service and preload essential chapters
   */
  async initialize() {
    console.log('🕌 Initializing QuranService...');

    try {
      // Load index first
      this.index = await this.loadQuranIndex();

      // Preload priority 1 chapters in background
      this.preloadPriorityChapters();

      console.log('✅ QuranService initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize QuranService:', error);
      return false;
    }
  }

  /**
   * Load Quran index with metadata
   */
  async loadQuranIndex() {
    const cacheKey = 'quran-index';

    // Try offline first
    if (this.offlineFirst) {
      const cached = await this.getCachedData(cacheKey);
      if (cached) {
        console.log('📱 Loaded Quran index from cache');
        return cached;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/data/quran/index.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      // Cache for offline use
      await this.setCachedData(cacheKey, data, 24 * 60 * 60 * 1000); // 24h TTL

      console.log('🌐 Loaded Quran index from network');
      return data;
    } catch (error) {
      console.error('Failed to load Quran index:', error);

      // Fallback to cached data if network fails
      const cached = await this.getCachedData(cacheKey);
      if (cached) {
        console.log('💾 Using cached Quran index as fallback');
        return cached;
      }

      throw error;
    }
  }

  /**
   * Load specific chapter with smart caching
   */
  async loadChapter(chapterNumber) {
    if (chapterNumber < 1 || chapterNumber > 114) {
      throw new Error('Invalid chapter number. Must be between 1 and 114.');
    }

    const cacheKey = `chapter-${chapterNumber}`;

    // Check memory cache first
    if (this.cache.has(cacheKey)) {
      console.log(`📋 Loaded chapter ${chapterNumber} from memory`);
      return this.cache.get(cacheKey);
    }

    // Try offline storage
    if (this.offlineFirst) {
      const cached = await this.getCachedData(cacheKey);
      if (cached) {
        this.cache.set(cacheKey, cached); // Also cache in memory
        console.log(`📱 Loaded chapter ${chapterNumber} from cache`);
        return cached;
      }
    }

    try {
      const paddedNumber = chapterNumber.toString().padStart(3, '0');
      const url = `${this.baseUrl}/data/quran/chapters/${paddedNumber}.json`;

      console.log(`🌐 Loading chapter ${chapterNumber} from network...`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to load chapter ${chapterNumber}: HTTP ${response.status}`);
      }

      const data = await response.json();

      // Cache in memory and storage
      this.cache.set(cacheKey, data);
      await this.setCachedData(cacheKey, data, 7 * 24 * 60 * 60 * 1000); // 7 days TTL

      console.log(`✅ Loaded chapter ${chapterNumber} successfully`);
      return data;

    } catch (error) {
      console.error(`❌ Failed to load chapter ${chapterNumber}:`, error);

      // Try cached data as fallback
      const cached = await this.getCachedData(cacheKey);
      if (cached) {
        console.log(`💾 Using cached chapter ${chapterNumber} as fallback`);
        this.cache.set(cacheKey, cached);
        return cached;
      }

      throw error;
    }
  }

  /**
   * Load multiple chapters efficiently
   */
  async loadChapters(chapterNumbers) {
    console.log(`🔄 Loading ${chapterNumbers.length} chapters...`);

    const promises = chapterNumbers.map(num => this.loadChapter(num));
    const results = await Promise.allSettled(promises);

    const successful = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);

    const failed = results
      .filter(result => result.status === 'rejected')
      .map((result, index) => ({ chapter: chapterNumbers[index], error: result.reason }));

    if (failed.length > 0) {
      console.warn('⚠️ Some chapters failed to load:', failed);
    }

    console.log(`✅ Loaded ${successful.length}/${chapterNumbers.length} chapters`);
    return successful;
  }

  /**
   * Preload priority chapters in background
   */
  async preloadPriorityChapters() {
    console.log('🔄 Preloading priority chapters...');

    try {
      // Load priority 1 chapters first
      await this.loadChapters(this.loadingPriority[1]);

      // Then load priority 2 chapters in background
      setTimeout(() => {
        this.loadChapters(this.loadingPriority[2]);
      }, 2000); // Delay to not interfere with user actions

    } catch (error) {
      console.warn('⚠️ Priority preloading partially failed:', error);
    }
  }

  /**
   * Search verses across chapters
   */
  async searchVerses(query, options = {}) {
    const { language = 'en', translation = 'sahih', limit = 50 } = options;

    console.log(`🔍 Searching for: "${query}"`);

    if (!this.index) {
      await this.loadQuranIndex();
    }

    const results = [];
    const searchTerm = query.toLowerCase();

    // Search through cached chapters first
    for (const [cacheKey, chapter] of this.cache.entries()) {
      if (!cacheKey.startsWith('chapter-')) continue;

      for (const verse of chapter.content) {
        const translationText = verse.translations?.[`${language}.${translation}`] || '';
        if (translationText.toLowerCase().includes(searchTerm)) {
          results.push({
            chapter: chapter.chapter,
            verse: verse.verse,
            arabic: verse.arabic,
            translation: translationText,
            transliteration: verse.transliteration
          });

          if (results.length >= limit) break;
        }
      }
      if (results.length >= limit) break;
    }

    console.log(`🎯 Found ${results.length} results for "${query}"`);
    return results;
  }

  /**
   * Get verse by reference (chapter:verse)
   */
  async getVerse(reference) {
    const [chapterNum, verseNum] = reference.split(':').map(Number);

    if (!chapterNum || !verseNum) {
      throw new Error('Invalid verse reference format. Use "chapter:verse" (e.g., "2:255")');
    }

    const chapter = await this.loadChapter(chapterNum);
    const verse = chapter.content.find(v => v.verse === verseNum);

    if (!verse) {
      throw new Error(`Verse ${reference} not found`);
    }

    return {
      chapter: chapter.chapter,
      chapterName: chapter.name,
      verse: verse.verse,
      arabic: verse.arabic,
      translation: verse.translations,
      transliteration: verse.transliteration,
      tafsir: verse.tafsir
    };
  }

  /**
   * Cache management
   */
  async getCachedData(key) {
    try {
      const item = this.storage.getItem(`quran-${key}`);
      if (!item) return null;

      const parsed = JSON.parse(item);

      // Check TTL
      if (parsed.expires && Date.now() > parsed.expires) {
        this.storage.removeItem(`quran-${key}`);
        return null;
      }

      return parsed.data;
    } catch (error) {
      console.warn(`Failed to get cached data for ${key}:`, error);
      return null;
    }
  }

  async setCachedData(key, data, ttlMs = 0) {
    try {
      const item = {
        data,
        expires: ttlMs > 0 ? Date.now() + ttlMs : null,
        cached: Date.now()
      };

      this.storage.setItem(`quran-${key}`, JSON.stringify(item));
    } catch (error) {
      console.warn(`Failed to cache data for ${key}:`, error);
    }
  }

  /**
   * Clear cache
   */
  async clearCache() {
    console.log('🧹 Clearing Quran cache...');

    // Clear memory cache
    this.cache.clear();

    // Clear storage cache
    try {
      const keys = Object.keys(this.storage);
      for (const key of keys) {
        if (key.startsWith('quran-')) {
          this.storage.removeItem(key);
        }
      }
      console.log('✅ Cache cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const memoryItems = this.cache.size;
    let storageItems = 0;
    let storageSize = 0;

    try {
      const keys = Object.keys(this.storage);
      for (const key of keys) {
        if (key.startsWith('quran-')) {
          storageItems++;
          storageSize += this.storage.getItem(key).length;
        }
      }
    } catch (error) {
      console.warn('Failed to calculate cache stats:', error);
    }

    return {
      memory: { items: memoryItems },
      storage: {
        items: storageItems,
        size: `${Math.round(storageSize / 1024)}KB`
      }
    };
  }

  /**
   * Check if chapter is commonly read (for prioritization)
   */
  isCommonlyRead(chapterNumber) {
    return this.loadingPriority[1].includes(chapterNumber) ||
           this.loadingPriority[2].includes(chapterNumber);
  }

  /**
   * Get recommended chapters for first-time users
   */
  getRecommendedChapters() {
    return {
      essential: this.loadingPriority[1], // Start here
      popular: this.loadingPriority[2],   // Then these
      description: 'Start with essential chapters (Al-Fatihah, short surahs), then explore popular ones'
    };
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QuranService; // Node.js
} else if (typeof window !== 'undefined') {
  window.QuranService = QuranService; // Browser
}

// Usage example:
/*
const quranService = new QuranService({
  baseUrl: 'https://cdn.jsdelivr.net/gh/username/islamic-data@main',
  offlineFirst: true,
  compression: true
});

await quranService.initialize();

// Load Al-Fatihah
const fatihah = await quranService.loadChapter(1);

// Get Ayat al-Kursi
const ayatAlKursi = await quranService.getVerse('2:255');

// Search for verses about patience
const results = await quranService.searchVerses('patience', {
  language: 'en',
  translation: 'sahih',
  limit: 10
});
*/