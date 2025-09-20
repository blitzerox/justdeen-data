#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Extract and convert duas from dua-dhikr-main to our optimized format
 */
class DuaExtractor {
  constructor() {
    this.sourceDir = path.join(__dirname, '..', 'dua-dhikr-main', 'data', 'dua-dhikr');
    this.targetDir = path.join(__dirname, '..', 'data', 'duas', 'categories');
    this.stats = {
      categoriesProcessed: 0,
      duasExtracted: 0,
      filesCreated: 0,
      errors: []
    };

    // Map source categories to our target categories
    this.categoryMapping = {
      'daily-dua': {
        target: 'daily',
        name: {
          arabic: "الأدعية اليومية",
          transliteration: "Al-Ad'iyah al-Yawmiyyah",
          translation: "Daily Supplications"
        },
        priority: 1,
        occasions: ["morning", "evening", "eating", "sleeping", "bathroom"]
      },
      'morning-dhikr': {
        target: 'morning',
        name: {
          arabic: "أذكار الصباح",
          transliteration: "Adhkar as-Sabah",
          translation: "Morning Remembrances"
        },
        priority: 1,
        occasions: ["morning"]
      },
      'evening-dhikr': {
        target: 'evening',
        name: {
          arabic: "أذكار المساء",
          transliteration: "Adhkar al-Masa'",
          translation: "Evening Remembrances"
        },
        priority: 1,
        occasions: ["evening"]
      },
      'dhikr-after-salah': {
        target: 'prayer',
        name: {
          arabic: "أذكار بعد الصلاة",
          transliteration: "Adhkar Ba'd as-Salah",
          translation: "Remembrances After Prayer"
        },
        priority: 1,
        occasions: ["prayer"]
      },
      'selected-dua': {
        target: 'essential',
        name: {
          arabic: "الأدعية المختارة",
          transliteration: "Al-Ad'iyah al-Mukhtarah",
          translation: "Essential Supplications"
        },
        priority: 1,
        occasions: ["various"]
      }
    };
  }

  async extractAllDuas() {
    console.log('🕌 Starting Dua extraction from dua-dhikr-main...');

    const categories = Object.keys(this.categoryMapping);

    for (const sourceCategory of categories) {
      await this.extractCategory(sourceCategory);
    }

    // Update the main index
    await this.updateDuasIndex();

    this.generateExtractionReport();
  }

  async extractCategory(sourceCategory) {
    console.log(`\n📂 Processing category: ${sourceCategory}`);

    const sourcePath = path.join(this.sourceDir, sourceCategory, 'en.json');
    const mapping = this.categoryMapping[sourceCategory];

    if (!fs.existsSync(sourcePath)) {
      console.warn(`⚠️ Source file not found: ${sourcePath}`);
      this.stats.errors.push(`Source file not found: ${sourceCategory}/en.json`);
      return;
    }

    try {
      const sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

      const extractedCategory = {
        category: mapping.target,
        name: mapping.name,
        totalDuas: sourceData.length,
        content: [],
        metadata: {
          totalWords: 0,
          averageLength: "medium",
          difficulties: {
            beginner: 0,
            intermediate: 0,
            advanced: 0
          },
          occasions: mapping.occasions,
          size: "0KB"
        }
      };

      // Convert each dua to our format
      sourceData.forEach((sourceDua, index) => {
        const convertedDua = this.convertDua(sourceDua, index + 1, mapping);
        if (convertedDua) {
          extractedCategory.content.push(convertedDua);
          this.stats.duasExtracted++;
        }
      });

      // Calculate metadata
      this.calculateCategoryMetadata(extractedCategory);

      // Save the converted category
      const targetPath = path.join(this.targetDir, `${mapping.target}.json`);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, JSON.stringify(extractedCategory, null, 2));

      console.log(`✅ Extracted ${extractedCategory.content.length} duas to ${mapping.target}.json`);
      this.stats.categoriesProcessed++;
      this.stats.filesCreated++;

    } catch (error) {
      console.error(`❌ Error processing ${sourceCategory}:`, error.message);
      this.stats.errors.push(`${sourceCategory}: ${error.message}`);
    }
  }

  convertDua(sourceDua, index, categoryMapping) {
    try {
      // Generate a unique ID based on category and index
      const id = `${categoryMapping.target}-${index.toString().padStart(2, '0')}`;

      // Determine occasion from title or use category default
      const occasion = this.determineOccasion(sourceDua.title, categoryMapping.occasions);

      // Map source fields to our schema
      const convertedDua = {
        id: id,
        occasion: occasion,
        name: {
          arabic: this.extractArabicTitle(sourceDua.title) || `دعاء ${index}`,
          transliteration: this.generateTransliteration(sourceDua.title),
          translation: sourceDua.title
        },
        arabic: sourceDua.arabic || "",
        transliteration: sourceDua.latin || "",
        translation: {
          en: sourceDua.translation || ""
        },
        source: {
          type: this.determineSourceType(sourceDua.source),
          reference: sourceDua.source || "Unknown"
        },
        repetitions: this.extractRepetitions(sourceDua.notes),
        difficulty: this.determineDifficulty(sourceDua.arabic)
      };

      // Add optional fields if present
      if (sourceDua.benefits || sourceDua.fawaid) {
        convertedDua.benefits = [sourceDua.benefits || sourceDua.fawaid];
      }

      if (this.extractTiming(sourceDua.title, sourceDua.notes)) {
        convertedDua.timing = this.extractTiming(sourceDua.title, sourceDua.notes);
      }

      return convertedDua;

    } catch (error) {
      console.warn(`⚠️ Error converting dua ${index}:`, error.message);
      return null;
    }
  }

  determineOccasion(title, defaultOccasions) {
    const titleLower = title.toLowerCase();

    const occasionMap = {
      'morning': ['morning', 'wake', 'dawn', 'fajr'],
      'evening': ['evening', 'sunset', 'maghrib'],
      'eating': ['eating', 'meal', 'food', 'drink'],
      'sleeping': ['sleeping', 'sleep', 'bed', 'night'],
      'prayer': ['prayer', 'salah', 'dhikr after'],
      'bathroom': ['bathroom', 'toilet', 'entering', 'leaving'],
      'travel': ['travel', 'journey'],
      'difficulty': ['protection', 'refuge', 'help']
    };

    for (const [occasion, keywords] of Object.entries(occasionMap)) {
      if (keywords.some(keyword => titleLower.includes(keyword))) {
        return occasion;
      }
    }

    return defaultOccasions[0] || 'various';
  }

  determineSourceType(source) {
    if (!source) return 'prophetic';

    const sourceLower = source.toLowerCase();
    if (sourceLower.includes('quran') || sourceLower.includes('qur')) return 'quran';
    if (sourceLower.includes('bukhari') || sourceLower.includes('muslim') ||
        sourceLower.includes('tirmidzi') || sourceLower.includes('dawud') ||
        sourceLower.includes('hr.') || sourceLower.includes('hadith')) return 'hadith';

    return 'prophetic';
  }

  extractRepetitions(notes) {
    if (!notes) return 1;

    const match = notes.match(/(\d+)x|(\d+) time/i);
    return match ? parseInt(match[1] || match[2]) : 1;
  }

  determineDifficulty(arabicText) {
    if (!arabicText) return 'beginner';

    const length = arabicText.length;
    if (length < 50) return 'beginner';
    if (length < 200) return 'intermediate';
    return 'advanced';
  }

  extractArabicTitle(title) {
    // Map common titles to Arabic
    const arabicTitles = {
      'Ayatul Kursi': 'آية الكرسي',
      'Al-Ikhlas': 'الإخلاص',
      'Al-Falaq': 'الفلق',
      'An-Naas': 'الناس',
      'Supplication Before Sleeping': 'دعاء قبل النوم',
      'Supplication Upon Waking Up': 'دعاء الاستيقاظ',
      'Supplication Before Eating': 'دعاء قبل الأكل',
      'Supplication After Eating': 'دعاء بعد الأكل'
    };

    return arabicTitles[title] || null;
  }

  generateTransliteration(title) {
    // Generate basic transliteration from English title
    return title.toLowerCase()
      .replace(/supplication/g, "du'a")
      .replace(/before/g, "qabla")
      .replace(/after/g, "ba'da")
      .replace(/upon/g, "'inda")
      .replace(/entering/g, "dukhul")
      .replace(/leaving/g, "khruj")
      .trim();
  }

  extractTiming(title, notes) {
    const timing = {};
    const titleLower = title.toLowerCase();

    if (titleLower.includes('morning') || titleLower.includes('wake')) {
      timing.preferred = "After Fajr prayer";
      timing.latest = "Before sunrise";
    } else if (titleLower.includes('evening')) {
      timing.preferred = "After Maghrib prayer";
      timing.latest = "Before sleep";
    } else if (titleLower.includes('eating')) {
      timing.when = "Before starting any meal";
    } else if (titleLower.includes('sleeping')) {
      timing.when = "Before going to sleep";
    } else if (titleLower.includes('bathroom')) {
      timing.when = titleLower.includes('entering') ? "When entering bathroom" : "When leaving bathroom";
    }

    return Object.keys(timing).length > 0 ? timing : null;
  }

  calculateCategoryMetadata(category) {
    let totalWords = 0;
    let totalLetters = 0;
    const difficulties = { beginner: 0, intermediate: 0, advanced: 0 };

    category.content.forEach(dua => {
      if (dua.arabic) {
        const words = dua.arabic.split(/\s+/).filter(w => w.length > 0);
        totalWords += words.length;
        totalLetters += dua.arabic.replace(/\s/g, '').length;
      }

      difficulties[dua.difficulty]++;
    });

    category.metadata.totalWords = totalWords;
    category.metadata.difficulties = difficulties;

    // Determine average length
    const avgWordsPerDua = totalWords / category.content.length;
    if (avgWordsPerDua < 10) {
      category.metadata.averageLength = "short";
    } else if (avgWordsPerDua < 50) {
      category.metadata.averageLength = "medium";
    } else {
      category.metadata.averageLength = "long";
    }

    // Calculate file size
    const jsonSize = JSON.stringify(category).length;
    if (jsonSize > 1024 * 1024) {
      category.metadata.size = `${Math.round(jsonSize / (1024 * 1024) * 10) / 10}MB`;
    } else {
      category.metadata.size = `${Math.round(jsonSize / 1024)}KB`;
    }
  }

  async updateDuasIndex() {
    console.log('\n📋 Updating duas index...');

    const indexPath = path.join(__dirname, '..', 'data', 'duas', 'index.json');

    // Get all categories we created
    const categories = [];
    let totalDuas = 0;

    Object.values(this.categoryMapping).forEach(mapping => {
      const categoryPath = path.join(this.targetDir, `${mapping.target}.json`);
      if (fs.existsSync(categoryPath)) {
        const categoryData = JSON.parse(fs.readFileSync(categoryPath, 'utf8'));

        categories.push({
          id: mapping.target,
          name: mapping.name,
          totalDuas: categoryData.totalDuas,
          url: `data/duas/categories/${mapping.target}.json`,
          priority: mapping.priority,
          description: this.generateDescription(mapping.target, categoryData),
          occasions: mapping.occasions
        });

        totalDuas += categoryData.totalDuas;
      }
    });

    const index = {
      duas: {
        version: "1.0.0",
        lastUpdated: new Date().toISOString(),
        totalCategories: categories.length,
        totalDuas: totalDuas,
        languages: {
          translations: ["en"],
          transliterations: ["en"]
        }
      },
      categories: categories,
      loadingStrategy: {
        priority1: categories.filter(c => c.priority === 1).map(c => c.id),
        priority2: [],
        priority3: "remaining"
      },
      searchIndex: {
        occasions: [...new Set(categories.flatMap(c => c.occasions))],
        sources: ["quran", "hadith", "prophetic"],
        difficulties: ["beginner", "intermediate", "advanced"]
      }
    };

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    console.log('✅ Updated duas index successfully');
  }

  generateDescription(categoryId, categoryData) {
    const descriptions = {
      daily: "Essential daily supplications for various activities",
      morning: "Morning dhikr and remembrances to start the day",
      evening: "Evening dhikr and remembrances for protection",
      prayer: "Remembrances and supplications after daily prayers",
      essential: "Important duas for various life situations"
    };

    return descriptions[categoryId] || `${categoryData.totalDuas} supplications for ${categoryId}`;
  }

  generateExtractionReport() {
    const report = {
      timestamp: new Date().toISOString(),
      extraction: {
        categoriesProcessed: this.stats.categoriesProcessed,
        duasExtracted: this.stats.duasExtracted,
        filesCreated: this.stats.filesCreated,
        errors: this.stats.errors.length,
        errorDetails: this.stats.errors
      },
      categories: Object.keys(this.categoryMapping).map(source => ({
        source: source,
        target: this.categoryMapping[source].target,
        status: this.stats.errors.some(e => e.includes(source)) ? 'error' : 'success'
      })),
      recommendations: [
        "Validate extracted files against schema",
        "Test with mobile integration",
        "Add audio pronunciations if available",
        "Consider adding more languages"
      ]
    };

    const reportPath = path.join(__dirname, '..', 'reports', 'dua-extraction-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n📋 EXTRACTION SUMMARY');
    console.log('====================');
    console.log(`✅ Categories processed: ${this.stats.categoriesProcessed}`);
    console.log(`✅ Duas extracted: ${this.stats.duasExtracted}`);
    console.log(`✅ Files created: ${this.stats.filesCreated}`);

    if (this.stats.errors.length > 0) {
      console.log(`⚠️ Errors: ${this.stats.errors.length} (see report for details)`);
    }

    console.log(`📊 Report saved: ${reportPath}`);
    console.log('\n🎉 Dua extraction completed successfully!');
  }
}

// Run extraction if called directly
if (require.main === module) {
  const extractor = new DuaExtractor();
  extractor.extractAllDuas().catch(console.error);
}

module.exports = DuaExtractor;