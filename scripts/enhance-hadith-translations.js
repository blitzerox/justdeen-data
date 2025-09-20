#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Enhance hadith with English translations by merging Arabic and English editions
 */
class HadithTranslationEnhancer {
  constructor() {
    this.sourceDir = path.join(__dirname, '..', 'hadith-api-1', 'editions');
    this.targetDir = path.join(__dirname, '..', 'data', 'hadith', 'collections');
    this.stats = {
      collectionsProcessed: 0,
      hadithEnhanced: 0,
      booksUpdated: 0,
      errors: []
    };

    // Map collections to their English editions
    this.translationMapping = {
      'bukhari': {
        english: 'eng-bukhari',
        urdu: 'urd-bukhari'
      },
      'muslim': {
        english: 'eng-muslim',
        urdu: 'urd-muslim'
      },
      'abudawud': {
        english: 'eng-abudawud',
        urdu: 'urd-abudawud'
      },
      'tirmidhi': {
        english: 'eng-tirmidhi',
        urdu: 'urd-tirmidhi'
      },
      'nasai': {
        english: 'eng-nasai',
        urdu: 'urd-nasai'
      },
      'majah': {
        english: 'eng-ibnmajah',
        urdu: 'urd-ibnmajah'
      }
    };
  }

  async enhanceAllCollections() {
    console.log('🔄 Starting hadith translation enhancement...');

    for (const [collection, sources] of Object.entries(this.translationMapping)) {
      await this.enhanceCollection(collection, sources);
    }

    this.generateEnhancementReport();
  }

  async enhanceCollection(collectionName, sources) {
    console.log(`\n📚 Enhancing collection: ${collectionName}`);

    const collectionDir = path.join(this.targetDir, collectionName);

    if (!fs.existsSync(collectionDir)) {
      console.warn(`⚠️ Collection directory not found: ${collectionDir}`);
      this.stats.errors.push(`Collection not found: ${collectionName}`);
      return;
    }

    // Load English translations
    const englishTranslations = await this.loadTranslations(sources.english);
    if (!englishTranslations) {
      console.warn(`⚠️ No English translations found for ${collectionName}`);
      this.stats.errors.push(`No English translations: ${collectionName}`);
      return;
    }

    // Create hadith number to translation mapping
    const translationMap = new Map();
    englishTranslations.hadiths.forEach(hadith => {
      translationMap.set(hadith.hadithnumber, hadith.text);
    });

    // Process each book file
    const bookFiles = fs.readdirSync(collectionDir)
      .filter(file => file.startsWith('book-') && file.endsWith('.json'));

    let booksUpdated = 0;
    let hadithEnhanced = 0;

    for (const bookFile of bookFiles) {
      const bookPath = path.join(collectionDir, bookFile);
      const bookData = JSON.parse(fs.readFileSync(bookPath, 'utf8'));

      let updated = false;

      // Enhance each hadith with translation
      bookData.content.forEach(hadith => {
        const englishText = translationMap.get(hadith.hadithNumber);

        if (englishText) {
          // Add English translation to the hadith
          if (!hadith.text.translations) {
            hadith.text.translations = {};
          }
          hadith.text.translations.en = englishText;

          // Extract narrator from English text if possible
          const narratorMatch = englishText.match(/^Narrated ([^:]+):/);
          if (narratorMatch && !hadith.narrator) {
            hadith.narrator = {
              en: narratorMatch[1].trim()
            };
          }

          updated = true;
          hadithEnhanced++;
        }
      });

      if (updated) {
        // Save updated book file
        fs.writeFileSync(bookPath, JSON.stringify(bookData, null, 2));
        booksUpdated++;
      }
    }

    console.log(`✅ Enhanced ${hadithEnhanced} hadith in ${booksUpdated} books for ${collectionName}`);

    this.stats.collectionsProcessed++;
    this.stats.booksUpdated += booksUpdated;
    this.stats.hadithEnhanced += hadithEnhanced;
  }

  async loadTranslations(editionName) {
    const translationPath = path.join(this.sourceDir, `${editionName}.json`);

    if (!fs.existsSync(translationPath)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(translationPath, 'utf8'));
    } catch (error) {
      console.error(`❌ Error loading ${editionName}:`, error.message);
      this.stats.errors.push(`Failed to load ${editionName}: ${error.message}`);
      return null;
    }
  }

  generateEnhancementReport() {
    const report = {
      timestamp: new Date().toISOString(),
      enhancement: {
        collectionsProcessed: this.stats.collectionsProcessed,
        hadithEnhanced: this.stats.hadithEnhanced,
        booksUpdated: this.stats.booksUpdated,
        errors: this.stats.errors.length,
        errorDetails: this.stats.errors
      },
      recommendations: [
        "Consider adding more languages (Urdu, French, Turkish, Indonesian)",
        "Add transliteration for Arabic names",
        "Implement hadith grading/authentication details",
        "Add commentary and explanations where available"
      ]
    };

    const reportPath = path.join(__dirname, '..', 'reports', 'hadith-enhancement-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n📋 ENHANCEMENT SUMMARY');
    console.log('====================');
    console.log(`✅ Collections processed: ${this.stats.collectionsProcessed}`);
    console.log(`✅ Hadith enhanced: ${this.stats.hadithEnhanced}`);
    console.log(`✅ Books updated: ${this.stats.booksUpdated}`);

    if (this.stats.errors.length > 0) {
      console.log(`⚠️ Errors: ${this.stats.errors.length} (see report for details)`);
    }

    console.log(`📊 Report saved: ${reportPath}`);
    console.log('\n🎉 Hadith translation enhancement completed successfully!');
  }
}

// Run enhancement if called directly
if (require.main === module) {
  const enhancer = new HadithTranslationEnhancer();
  enhancer.enhanceAllCollections().catch(console.error);
}

module.exports = HadithTranslationEnhancer;