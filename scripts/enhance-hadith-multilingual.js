#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Enhance hadith with multiple language translations
 */
class HadithMultilingualEnhancer {
  constructor() {
    this.sourceDir = path.join(__dirname, '..', 'hadith-api-1', 'editions');
    this.targetDir = path.join(__dirname, '..', 'data', 'hadith', 'collections');
    this.stats = {
      collectionsProcessed: 0,
      languagesAdded: 0,
      hadithEnhanced: 0,
      booksUpdated: 0,
      errors: []
    };

    // Map collections to their available language editions
    this.translationMapping = {
      'bukhari': {
        'en': 'eng-bukhari',
        'ur': 'urd-bukhari',
        'fr': 'fra-bukhari',
        'id': 'ind-bukhari',
        'tr': 'tur-bukhari'
      },
      'muslim': {
        'en': 'eng-muslim',
        'ur': 'urd-muslim',
        'fr': 'fra-muslim',
        'id': 'ind-muslim',
        'tr': 'tur-muslim'
      },
      'abudawud': {
        'en': 'eng-abudawud',
        'ur': 'urd-abudawud',
        'fr': 'fra-abudawud',
        'id': 'ind-abudawud',
        'tr': 'tur-abudawud'
      },
      'tirmidhi': {
        'en': 'eng-tirmidhi',
        'ur': 'urd-tirmidhi',
        'fr': 'fra-tirmidhi',
        'id': 'ind-tirmidhi',
        'tr': 'tur-tirmidhi'
      },
      'nasai': {
        'en': 'eng-nasai',
        'ur': 'urd-nasai',
        'fr': 'fra-nasai',
        'id': 'ind-nasai',
        'tr': 'tur-nasai'
      },
      'majah': {
        'en': 'eng-ibnmajah',
        'ur': 'urd-ibnmajah',
        'fr': 'fra-ibnmajah',
        'id': 'ind-ibnmajah',
        'tr': 'tur-ibnmajah'
      }
    };

    // Language codes to names mapping
    this.languageNames = {
      'en': 'English',
      'ur': 'Urdu',
      'fr': 'French',
      'id': 'Indonesian',
      'tr': 'Turkish'
    };
  }

  async enhanceAllCollections() {
    console.log('🌍 Starting multilingual hadith enhancement...');

    for (const [collection, languages] of Object.entries(this.translationMapping)) {
      await this.enhanceCollection(collection, languages);
    }

    this.generateEnhancementReport();
  }

  async enhanceCollection(collectionName, languageSources) {
    console.log(`\n📚 Enhancing collection: ${collectionName}`);

    const collectionDir = path.join(this.targetDir, collectionName);

    if (!fs.existsSync(collectionDir)) {
      console.warn(`⚠️ Collection directory not found: ${collectionDir}`);
      this.stats.errors.push(`Collection not found: ${collectionName}`);
      return;
    }

    // Load translations for all available languages
    const translationMaps = {};
    let languagesLoaded = 0;

    for (const [langCode, editionName] of Object.entries(languageSources)) {
      // Skip English if already processed
      if (langCode === 'en') {
        const testBookPath = path.join(collectionDir, 'book-001.json');
        if (fs.existsSync(testBookPath)) {
          const testBook = JSON.parse(fs.readFileSync(testBookPath, 'utf8'));
          if (testBook.content[0]?.text?.translations?.en) {
            console.log(`✓ English translations already exist for ${collectionName}`);
            continue;
          }
        }
      }

      const translations = await this.loadTranslations(editionName);
      if (translations) {
        translationMaps[langCode] = new Map();
        translations.hadiths.forEach(hadith => {
          translationMaps[langCode].set(hadith.hadithnumber, hadith.text);
        });
        console.log(`✓ Loaded ${this.languageNames[langCode]} translations (${translations.hadiths.length} hadith)`);
        languagesLoaded++;
      } else {
        console.warn(`⚠️ No ${this.languageNames[langCode]} translations found for ${collectionName}`);
      }
    }

    if (languagesLoaded === 0) {
      console.warn(`⚠️ No new translations to add for ${collectionName}`);
      return;
    }

    // Process each book file
    const bookFiles = fs.readdirSync(collectionDir)
      .filter(file => file.startsWith('book-') && file.endsWith('.json'));

    let booksUpdated = 0;
    let hadithEnhanced = 0;

    for (const bookFile of bookFiles) {
      const bookPath = path.join(collectionDir, bookFile);
      const bookData = JSON.parse(fs.readFileSync(bookPath, 'utf8'));

      let updated = false;

      // Enhance each hadith with translations
      bookData.content.forEach(hadith => {
        let hadithUpdated = false;

        // Ensure translations object exists
        if (!hadith.text.translations) {
          hadith.text.translations = {};
        }

        // Add translations for each language
        for (const [langCode, translationMap] of Object.entries(translationMaps)) {
          const translationText = translationMap.get(hadith.hadithNumber);

          if (translationText && !hadith.text.translations[langCode]) {
            hadith.text.translations[langCode] = translationText;
            hadithUpdated = true;

            // Extract narrator from English text if not already present
            if (langCode === 'en' && !hadith.narrator) {
              const narratorMatch = translationText.match(/^Narrated ([^:]+):/);
              if (narratorMatch) {
                hadith.narrator = {
                  en: narratorMatch[1].trim()
                };
              }
            }
          }
        }

        if (hadithUpdated) {
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
    console.log(`   Languages added: ${Object.keys(translationMaps).map(code => this.languageNames[code]).join(', ')}`);

    this.stats.collectionsProcessed++;
    this.stats.booksUpdated += booksUpdated;
    this.stats.hadithEnhanced += hadithEnhanced;
    this.stats.languagesAdded += languagesLoaded;
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
        languagesAdded: this.stats.languagesAdded,
        hadithEnhanced: this.stats.hadithEnhanced,
        booksUpdated: this.stats.booksUpdated,
        errors: this.stats.errors.length,
        errorDetails: this.stats.errors
      },
      languages: Object.keys(this.languageNames).map(code => ({
        code: code,
        name: this.languageNames[code],
        status: 'available'
      })),
      recommendations: [
        "Add transliteration support for Arabic names",
        "Implement language-specific narrator extraction",
        "Add hadith grading/authentication details",
        "Consider adding more languages (Bengali, Malay, etc.)"
      ]
    };

    const reportPath = path.join(__dirname, '..', 'reports', 'hadith-multilingual-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n📋 MULTILINGUAL ENHANCEMENT SUMMARY');
    console.log('===================================');
    console.log(`✅ Collections processed: ${this.stats.collectionsProcessed}`);
    console.log(`✅ Languages added: ${this.stats.languagesAdded}`);
    console.log(`✅ Hadith enhanced: ${this.stats.hadithEnhanced}`);
    console.log(`✅ Books updated: ${this.stats.booksUpdated}`);

    if (this.stats.errors.length > 0) {
      console.log(`⚠️ Errors: ${this.stats.errors.length} (see report for details)`);
    }

    // Update the main hadith index with language information
    this.updateHadithIndex();

    console.log(`📊 Report saved: ${reportPath}`);
    console.log('\n🎉 Multilingual hadith enhancement completed successfully!');
  }

  updateHadithIndex() {
    const indexPath = path.join(__dirname, '..', 'data', 'hadith', 'index.json');

    if (fs.existsSync(indexPath)) {
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

      // Update languages in index
      index.hadith.languages = {
        translations: ["en", "ur", "fr", "id", "tr"],
        transliterations: ["en"] // Keeping as is for now
      };

      fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
      console.log('✅ Updated hadith index with language information');
    }
  }
}

// Run enhancement if called directly
if (require.main === module) {
  const enhancer = new HadithMultilingualEnhancer();
  enhancer.enhanceAllCollections().catch(console.error);
}

module.exports = HadithMultilingualEnhancer;