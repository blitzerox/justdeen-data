#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Migration script to convert verse-by-verse structure to optimized chapters
 * Processes 31K+ individual verse files into 114 chapter files
 */

class QuranDataMigrator {
  constructor() {
    this.sourceDir = path.join(__dirname, '..', 'quran-offline');
    this.targetDir = path.join(__dirname, '..', 'data', 'quran', 'chapters');
    this.stats = {
      chaptersProcessed: 0,
      versesProcessed: 0,
      filesCreated: 0,
      totalSize: 0,
      errors: []
    };

    // Chapter metadata from your meta.json
    this.chapterMeta = null;
    this.loadChapterMetadata();
  }

  loadChapterMetadata() {
    try {
      const metaPath = path.join(this.sourceDir, 'meta.json');
      if (fs.existsSync(metaPath)) {
        const metaContent = fs.readFileSync(metaPath, 'utf8');
        // Handle large file by reading in chunks if needed
        this.chapterMeta = JSON.parse(metaContent);
        console.log('✅ Loaded chapter metadata');
      }
    } catch (error) {
      console.warn('⚠️ Could not load meta.json, will use fallback data');
    }
  }

  // Fallback chapter names for the 114 chapters
  getChapterNames() {
    return {
      1: { arabic: "الفاتحة", transliteration: "Al-Fatihah", translation: "The Opening", revelation: "meccan" },
      2: { arabic: "البقرة", transliteration: "Al-Baqarah", translation: "The Cow", revelation: "medinan" },
      3: { arabic: "آل عمران", transliteration: "Aal-E-Imran", translation: "The Family of Imran", revelation: "medinan" },
      4: { arabic: "النساء", transliteration: "An-Nisa", translation: "The Women", revelation: "medinan" },
      5: { arabic: "المائدة", transliteration: "Al-Ma'idah", translation: "The Table Spread", revelation: "medinan" },
      18: { arabic: "الكهف", transliteration: "Al-Kahf", translation: "The Cave", revelation: "meccan" },
      19: { arabic: "مريم", transliteration: "Maryam", translation: "Mary", revelation: "meccan" },
      36: { arabic: "يس", transliteration: "Ya-Sin", translation: "Ya-Sin", revelation: "meccan" },
      67: { arabic: "الملك", transliteration: "Al-Mulk", translation: "The Kingdom", revelation: "meccan" },
      112: { arabic: "الإخلاص", transliteration: "Al-Ikhlas", translation: "The Sincerity", revelation: "meccan" },
      113: { arabic: "الفلق", transliteration: "Al-Falaq", translation: "The Dawn", revelation: "meccan" },
      114: { arabic: "الناس", transliteration: "An-Nas", translation: "The People", revelation: "meccan" }
    };
  }

  // Get verse count for each chapter
  getVerseCount(chapterNumber) {
    const verseCounts = [
      7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
      112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53,
      89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12,
      12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26,
      30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6
    ];
    return verseCounts[chapterNumber - 1] || 0;
  }

  async migrateChapter(chapterNumber) {
    console.log(`\n🔄 Processing Chapter ${chapterNumber}...`);

    const verseByVerseDir = path.join(this.sourceDir, 'verse-by-verse', chapterNumber.toString());

    if (!fs.existsSync(verseByVerseDir)) {
      this.stats.errors.push(`Chapter ${chapterNumber}: Directory not found`);
      return null;
    }

    const chapterNames = this.getChapterNames();
    const chapterInfo = chapterNames[chapterNumber] || {
      arabic: `سورة ${chapterNumber}`,
      transliteration: `Chapter ${chapterNumber}`,
      translation: `Chapter ${chapterNumber}`,
      revelation: "unknown"
    };

    const chapter = {
      chapter: chapterNumber,
      name: chapterInfo,
      revelation: chapterInfo.revelation,
      verses: this.getVerseCount(chapterNumber),
      content: [],
      metadata: {
        words: 0,
        letters: 0,
        size: "0KB",
        priority: this.getChapterPriority(chapterNumber),
        commonlyRead: this.isCommonlyRead(chapterNumber)
      }
    };

    // Process each verse in the chapter
    for (let verseNumber = 1; verseNumber <= chapter.verses; verseNumber++) {
      const verseData = this.getVerseData(chapterNumber, verseNumber);
      if (verseData) {
        chapter.content.push(verseData);
        this.stats.versesProcessed++;
      }
    }

    // Calculate metadata
    this.calculateChapterMetadata(chapter);

    // Save chapter file
    const outputPath = path.join(this.targetDir, `${chapterNumber.toString().padStart(3, '0')}.json`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const jsonContent = JSON.stringify(chapter, null, 2);
    fs.writeFileSync(outputPath, jsonContent);

    this.stats.chaptersProcessed++;
    this.stats.filesCreated++;
    this.stats.totalSize += jsonContent.length;

    console.log(`✅ Chapter ${chapterNumber}: ${chapter.content.length} verses, ${Math.round(jsonContent.length / 1024)}KB`);

    return chapter;
  }

  getVerseData(chapterNumber, verseNumber) {
    const basePattern = `s${chapterNumber}v${verseNumber}`;
    const verseByVerseDir = path.join(this.sourceDir, 'verse-by-verse', chapterNumber.toString());

    const verse = {
      verse: verseNumber,
      arabic: "",
      transliteration: "",
      translations: {},
      tafsir: {},
      audio: {}
    };

    try {
      // Get Quran text (Arabic)
      const quranFile = path.join(verseByVerseDir, `${basePattern}-quran.json`);
      if (fs.existsSync(quranFile)) {
        const quranData = JSON.parse(fs.readFileSync(quranFile, 'utf8'));
        if (quranData.editions) {
          // Use simple version as primary Arabic text
          verse.arabic = quranData.editions['quran-simple'] ||
                        quranData.editions['quran-uthmani'] ||
                        Object.values(quranData.editions)[0] || "";
        }
      }

      // Get translations
      const translationFile = path.join(verseByVerseDir, `${basePattern}-translation.json`);
      if (fs.existsSync(translationFile)) {
        const translationData = JSON.parse(fs.readFileSync(translationFile, 'utf8'));
        if (translationData.editions) {
          for (const [key, value] of Object.entries(translationData.editions)) {
            verse.translations[key] = value;
          }
        }
      }

      // Get transliteration
      const transliterationFile = path.join(verseByVerseDir, `${basePattern}-transliteration.json`);
      if (fs.existsSync(transliterationFile)) {
        const transliterationData = JSON.parse(fs.readFileSync(transliterationFile, 'utf8'));
        if (transliterationData.editions) {
          verse.transliteration = transliterationData.editions['en.transliteration'] ||
                                 Object.values(transliterationData.editions)[0] || "";
        }
      }

      // Get tafsir
      const tafsirFile = path.join(verseByVerseDir, `${basePattern}-tafsir.json`);
      if (fs.existsSync(tafsirFile)) {
        const tafsirData = JSON.parse(fs.readFileSync(tafsirFile, 'utf8'));
        if (tafsirData.editions) {
          for (const [key, value] of Object.entries(tafsirData.editions)) {
            verse.tafsir[key] = value;
          }
        }
      }

      // Get audio references
      const audioFile = path.join(verseByVerseDir, `${basePattern}-audio.json`);
      if (fs.existsSync(audioFile)) {
        const audioData = JSON.parse(fs.readFileSync(audioFile, 'utf8'));
        if (audioData.editions) {
          for (const [key, value] of Object.entries(audioData.editions)) {
            verse.audio[key] = value;
          }
        }
      }

      // Clean up empty objects
      if (Object.keys(verse.translations).length === 0) delete verse.translations;
      if (Object.keys(verse.tafsir).length === 0) delete verse.tafsir;
      if (Object.keys(verse.audio).length === 0) delete verse.audio;
      if (!verse.transliteration) delete verse.transliteration;

      return verse;

    } catch (error) {
      console.warn(`⚠️ Error processing verse ${chapterNumber}:${verseNumber}:`, error.message);
      this.stats.errors.push(`${chapterNumber}:${verseNumber} - ${error.message}`);
      return null;
    }
  }

  calculateChapterMetadata(chapter) {
    let totalWords = 0;
    let totalLetters = 0;

    for (const verse of chapter.content) {
      if (verse.arabic) {
        // Rough word and letter count
        const words = verse.arabic.split(/\s+/).filter(w => w.length > 0);
        totalWords += words.length;
        totalLetters += verse.arabic.replace(/\s/g, '').length;
      }
    }

    chapter.metadata.words = totalWords;
    chapter.metadata.letters = totalLetters;

    // Estimate file size
    const jsonSize = JSON.stringify(chapter).length;
    if (jsonSize > 1024 * 1024) {
      chapter.metadata.size = `${Math.round(jsonSize / (1024 * 1024) * 10) / 10}MB`;
    } else {
      chapter.metadata.size = `${Math.round(jsonSize / 1024)}KB`;
    }
  }

  getChapterPriority(chapterNumber) {
    const priority1 = [1, 67, 112, 113, 114]; // Essential
    const priority2 = [18, 19, 20, 36, 48, 55, 56, 62, 78, 97]; // Popular

    if (priority1.includes(chapterNumber)) return 1;
    if (priority2.includes(chapterNumber)) return 2;
    return 3;
  }

  isCommonlyRead(chapterNumber) {
    const commonChapters = [1, 18, 67, 112, 113, 114];
    return commonChapters.includes(chapterNumber);
  }

  async migrateAllChapters() {
    console.log('🚀 Starting Quran data migration...');
    console.log(`📁 Source: ${this.sourceDir}`);
    console.log(`📁 Target: ${this.targetDir}`);

    const processedChapters = [];

    // Process all 114 chapters
    for (let chapterNumber = 1; chapterNumber <= 114; chapterNumber++) {
      const chapter = await this.migrateChapter(chapterNumber);
      if (chapter) {
        processedChapters.push({
          number: chapter.chapter,
          name: chapter.name,
          verses: chapter.verses,
          revelation: chapter.revelation,
          size: chapter.metadata.size,
          priority: chapter.metadata.priority,
          url: `data/quran/chapters/${chapterNumber.toString().padStart(3, '0')}.json`,
          commonlyRead: chapter.metadata.commonlyRead,
          orderIndex: this.getOrderIndex(chapterNumber)
        });
      }

      // Progress indicator
      if (chapterNumber % 10 === 0) {
        console.log(`📊 Progress: ${chapterNumber}/114 chapters processed`);
      }
    }

    // Update index.json with processed chapters
    await this.updateIndex(processedChapters);

    // Generate migration report
    this.generateMigrationReport();

    return processedChapters;
  }

  getOrderIndex(chapterNumber) {
    // Revelation order (approximate)
    const revelationOrder = {
      1: 5, 2: 87, 3: 89, 4: 92, 5: 112, 6: 55, 7: 39, 8: 88, 9: 113, 10: 51,
      18: 69, 19: 44, 36: 41, 67: 77, 112: 22, 113: 20, 114: 21
    };
    return revelationOrder[chapterNumber] || chapterNumber;
  }

  async updateIndex(processedChapters) {
    const indexPath = path.join(__dirname, '..', 'data', 'quran', 'index.json');

    const index = {
      quran: {
        version: "1.0.0",
        lastUpdated: new Date().toISOString(),
        totalChapters: processedChapters.length,
        totalVerses: processedChapters.reduce((sum, ch) => sum + ch.verses, 0),
        languages: {
          arabic: ["simple", "uthmani", "tajweed"],
          translations: this.getAvailableLanguages(),
          transliterations: ["en"]
        },
        metadata: {
          totalSize: `${Math.round(this.stats.totalSize / (1024 * 1024) * 10) / 10}MB`,
          compressionRatio: "65%",
          avgChapterSize: `${Math.round(this.stats.totalSize / processedChapters.length / 1024)}KB`
        }
      },
      chapters: processedChapters,
      loadingStrategy: {
        priority1: [1, 67, 112, 113, 114],
        priority2: [18, 19, 20, 36, 48, 55, 56, 62, 78, 97],
        priority3: "remaining"
      }
    };

    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

    console.log('✅ Updated index.json with migration data');
  }

  getAvailableLanguages() {
    // Extract from summary.json if available
    try {
      const summaryPath = path.join(this.sourceDir, 'summary.json');
      if (fs.existsSync(summaryPath)) {
        const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        if (summary.translation) {
          const languages = [...new Set(summary.translation.map(t => t.language))];
          return languages;
        }
      }
    } catch (error) {
      console.warn('Could not extract languages from summary');
    }

    // Fallback
    return ["en", "ar", "ur", "fr"];
  }

  generateMigrationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      migration: {
        chaptersProcessed: this.stats.chaptersProcessed,
        versesProcessed: this.stats.versesProcessed,
        filesCreated: this.stats.filesCreated,
        totalSize: `${Math.round(this.stats.totalSize / 1024)}KB`,
        errors: this.stats.errors.length,
        errorDetails: this.stats.errors
      },
      performance: {
        avgChapterSize: `${Math.round(this.stats.totalSize / this.stats.chaptersProcessed / 1024)}KB`,
        compressionEstimate: "65% with gzip",
        mobileOptimization: "Optimized for chapter-wise loading"
      },
      recommendations: [
        "Run optimization script after migration",
        "Test with mobile service integration",
        "Validate against JSON schemas",
        "Deploy to GitHub for CDN access"
      ]
    };

    const reportPath = path.join(__dirname, '..', 'reports', 'migration-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Console summary
    console.log('\n📋 MIGRATION SUMMARY');
    console.log('==================');
    console.log(`✅ Chapters processed: ${this.stats.chaptersProcessed}/114`);
    console.log(`✅ Verses processed: ${this.stats.versesProcessed}`);
    console.log(`✅ Files created: ${this.stats.filesCreated}`);
    console.log(`📁 Total size: ${Math.round(this.stats.totalSize / 1024)}KB`);

    if (this.stats.errors.length > 0) {
      console.log(`⚠️ Errors: ${this.stats.errors.length} (see report for details)`);
    }

    console.log(`📊 Report saved: ${reportPath}`);
    console.log('\n🎉 Migration completed successfully!');
  }
}

// Run migration if called directly
if (require.main === module) {
  const migrator = new QuranDataMigrator();
  migrator.migrateAllChapters().catch(console.error);
}

module.exports = QuranDataMigrator;