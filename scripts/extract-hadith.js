#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Extract and convert hadith from hadith-api-1 to our optimized format
 */
class HadithExtractor {
  constructor() {
    this.sourceDir = path.join(__dirname, '..', 'hadith-api-1', 'editions');
    this.targetDir = path.join(__dirname, '..', 'data', 'hadith', 'collections');
    this.stats = {
      collectionsProcessed: 0,
      hadithExtracted: 0,
      booksCreated: 0,
      errors: []
    };

    // Map source collections to our target collections
    this.collectionMapping = {
      'ara-bukhari': {
        target: 'bukhari',
        name: {
          arabic: "صحيح البخاري",
          transliteration: "Sahih al-Bukhari",
          translation: "The Authentic Collection of al-Bukhari"
        },
        compiler: {
          arabic: "محمد بن إسماعيل البخاري",
          transliteration: "Muhammad ibn Isma'il al-Bukhari",
          dates: "194-256 AH"
        },
        authenticity: "sahih",
        priority: 1,
        description: "The most authentic collection of hadith after the Quran"
      },
      'ara-muslim': {
        target: 'muslim',
        name: {
          arabic: "صحيح مسلم",
          transliteration: "Sahih Muslim",
          translation: "The Authentic Collection of Muslim"
        },
        compiler: {
          arabic: "مسلم بن الحجاج النيسابوري",
          transliteration: "Muslim ibn al-Hajjaj an-Naysaburi",
          dates: "206-261 AH"
        },
        authenticity: "sahih",
        priority: 1,
        description: "Second most authentic collection of hadith"
      },
      'ara-abudawud': {
        target: 'abudawud',
        name: {
          arabic: "سنن أبي داود",
          transliteration: "Sunan Abi Dawud",
          translation: "The Sunan of Abu Dawud"
        },
        compiler: {
          arabic: "أبو داود السجستاني",
          transliteration: "Abu Dawud as-Sijistani",
          dates: "202-275 AH"
        },
        authenticity: "hasan-sahih",
        priority: 2,
        description: "Collection focusing on legal hadith"
      },
      'ara-tirmidhi': {
        target: 'tirmidhi',
        name: {
          arabic: "جامع الترمذي",
          transliteration: "Jami' at-Tirmidhi",
          translation: "The Collection of at-Tirmidhi"
        },
        compiler: {
          arabic: "محمد بن عيسى الترمذي",
          transliteration: "Muhammad ibn Isa at-Tirmidhi",
          dates: "209-279 AH"
        },
        authenticity: "hasan-sahih",
        priority: 2,
        description: "Comprehensive collection with authenticity grading"
      },
      'ara-nasai': {
        target: 'nasai',
        name: {
          arabic: "سنن النسائي",
          transliteration: "Sunan an-Nasa'i",
          translation: "The Sunan of an-Nasa'i"
        },
        compiler: {
          arabic: "أحمد بن شعيب النسائي",
          transliteration: "Ahmad ibn Shu'ayb an-Nasa'i",
          dates: "215-303 AH"
        },
        authenticity: "sahih-hasan",
        priority: 2,
        description: "Collection known for strict authenticity standards"
      },
      'ara-ibnmajah': {
        target: 'majah',
        name: {
          arabic: "سنن ابن ماجه",
          transliteration: "Sunan Ibn Majah",
          translation: "The Sunan of Ibn Majah"
        },
        compiler: {
          arabic: "محمد بن يزيد ابن ماجه",
          transliteration: "Muhammad ibn Yazid Ibn Majah",
          dates: "209-273 AH"
        },
        authenticity: "mixed",
        priority: 2,
        description: "Collection completing the six major hadith books"
      }
    };
  }

  async extractAllHadith() {
    console.log('📚 Starting Hadith extraction from hadith-api-1...');

    const collections = Object.keys(this.collectionMapping);

    for (const sourceCollection of collections) {
      await this.extractCollection(sourceCollection);
    }

    // Update the main index
    await this.updateHadithIndex();

    this.generateExtractionReport();
  }

  async extractCollection(sourceCollection) {
    console.log(`\n📖 Processing collection: ${sourceCollection}`);

    const sourcePath = path.join(this.sourceDir, `${sourceCollection}.json`);
    const mapping = this.collectionMapping[sourceCollection];

    if (!fs.existsSync(sourcePath)) {
      console.warn(`⚠️ Source file not found: ${sourcePath}`);
      this.stats.errors.push(`Source file not found: ${sourceCollection}.json`);
      return;
    }

    try {
      const sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

      // Create collection directory
      const collectionDir = path.join(this.targetDir, mapping.target);
      fs.mkdirSync(collectionDir, { recursive: true });

      // Extract collection metadata
      const collectionInfo = {
        collection: mapping.target,
        name: mapping.name,
        compiler: mapping.compiler,
        authenticity: mapping.authenticity,
        totalBooks: Object.keys(sourceData.metadata.sections).length - 1, // Exclude section "0"
        totalHadith: sourceData.hadiths.length,
        metadata: {
          extractedFrom: sourceCollection,
          sourceFormat: "hadith-api-1",
          extractionDate: new Date().toISOString(),
          description: mapping.description,
          priority: mapping.priority
        }
      };

      // Group hadith by books/sections
      const bookGroups = this.groupHadithByBooks(sourceData, mapping);

      // Create individual book files
      let bookCount = 0;
      for (const [bookNumber, bookData] of Object.entries(bookGroups)) {
        await this.createBookFile(collectionDir, mapping.target, bookNumber, bookData, sourceData.metadata.sections);
        bookCount++;
        this.stats.booksCreated++;
      }

      // Save collection info
      const collectionInfoPath = path.join(collectionDir, 'collection.json');
      collectionInfo.totalBooks = bookCount;
      fs.writeFileSync(collectionInfoPath, JSON.stringify(collectionInfo, null, 2));

      console.log(`✅ Extracted ${collectionInfo.totalHadith} hadith in ${bookCount} books for ${mapping.target}`);
      this.stats.collectionsProcessed++;
      this.stats.hadithExtracted += collectionInfo.totalHadith;

    } catch (error) {
      console.error(`❌ Error processing ${sourceCollection}:`, error.message);
      this.stats.errors.push(`${sourceCollection}: ${error.message}`);
    }
  }

  groupHadithByBooks(sourceData, mapping) {
    const books = {};

    sourceData.hadiths.forEach(hadith => {
      const bookNumber = hadith.reference.book;

      if (!books[bookNumber]) {
        books[bookNumber] = {
          hadith: [],
          metadata: {
            bookNumber: bookNumber,
            hadithnumberRange: {
              first: hadith.hadithnumber,
              last: hadith.hadithnumber
            }
          }
        };
      }

      books[bookNumber].hadith.push(this.convertHadith(hadith, mapping));

      // Update range
      if (hadith.hadithnumber < books[bookNumber].metadata.hadithnumberRange.first) {
        books[bookNumber].metadata.hadithnumberRange.first = hadith.hadithnumber;
      }
      if (hadith.hadithnumber > books[bookNumber].metadata.hadithnumberRange.last) {
        books[bookNumber].metadata.hadithnumberRange.last = hadith.hadithnumber;
      }
    });

    return books;
  }

  convertHadith(sourceHadith, collectionMapping) {
    return {
      hadithNumber: sourceHadith.hadithnumber,
      arabicNumber: sourceHadith.arabicnumber,
      book: sourceHadith.reference.book,
      hadithInBook: sourceHadith.reference.hadith,
      text: {
        arabic: sourceHadith.text
      },
      grades: sourceHadith.grades || [],
      reference: {
        collection: collectionMapping.target,
        book: sourceHadith.reference.book,
        hadith: sourceHadith.reference.hadith
      }
    };
  }

  async createBookFile(collectionDir, collectionName, bookNumber, bookData, sectionNames) {
    const bookName = sectionNames[bookNumber] || `Book ${bookNumber}`;

    const bookFile = {
      collection: collectionName,
      book: parseInt(bookNumber),
      name: {
        arabic: this.getArabicBookName(bookName),
        transliteration: this.getTransliterationBookName(bookName),
        translation: bookName
      },
      totalHadith: bookData.hadith.length,
      hadithNumberRange: bookData.metadata.hadithnumberRange,
      content: bookData.hadith,
      metadata: {
        averageLength: this.calculateAverageLength(bookData.hadith),
        size: "0KB" // Will be calculated after JSON.stringify
      }
    };

    // Calculate file size
    const jsonSize = JSON.stringify(bookFile).length;
    if (jsonSize > 1024 * 1024) {
      bookFile.metadata.size = `${Math.round(jsonSize / (1024 * 1024) * 10) / 10}MB`;
    } else {
      bookFile.metadata.size = `${Math.round(jsonSize / 1024)}KB`;
    }

    const bookPath = path.join(collectionDir, `book-${bookNumber.toString().padStart(3, '0')}.json`);
    fs.writeFileSync(bookPath, JSON.stringify(bookFile, null, 2));
  }

  getArabicBookName(englishName) {
    // Map common book names to Arabic - simplified for now
    const arabicNames = {
      'Revelation': 'الوحي',
      'Belief': 'الإيمان',
      'Knowledge': 'العلم',
      'Ablutions (Wudu\')': 'الوضوء',
      'Prayers (Salat)': 'الصلاة',
      'The Book of Faith': 'كتاب الإيمان',
      'The Book of Purification': 'كتاب الطهارة',
      'The Book of Prayers': 'كتاب الصلاة'
    };

    return arabicNames[englishName] || `كتاب ${englishName}`;
  }

  getTransliterationBookName(englishName) {
    // Generate basic transliteration
    return englishName.toLowerCase()
      .replace(/the book of/g, "kitab")
      .replace(/prayers/g, "salah")
      .replace(/ablutions/g, "wudu")
      .replace(/belief/g, "iman")
      .replace(/knowledge/g, "ilm")
      .trim();
  }

  calculateAverageLength(hadithList) {
    if (hadithList.length === 0) return "short";

    const totalLength = hadithList.reduce((sum, hadith) => {
      return sum + (hadith.text.arabic?.length || 0);
    }, 0);

    const avgLength = totalLength / hadithList.length;

    if (avgLength < 200) return "short";
    if (avgLength < 500) return "medium";
    return "long";
  }

  async updateHadithIndex() {
    console.log('\n📋 Updating hadith index...');

    const indexPath = path.join(__dirname, '..', 'data', 'hadith', 'index.json');

    // Get all collections we created
    const collections = [];
    let totalBooks = 0;
    let totalHadith = 0;

    Object.values(this.collectionMapping).forEach(mapping => {
      const collectionPath = path.join(this.targetDir, mapping.target, 'collection.json');
      if (fs.existsSync(collectionPath)) {
        const collectionData = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));

        collections.push({
          name: mapping.target,
          title: mapping.name,
          compiler: mapping.compiler,
          authenticity: mapping.authenticity,
          totalBooks: collectionData.totalBooks,
          totalHadith: collectionData.totalHadith,
          url: `data/hadith/collections/${mapping.target}/`,
          priority: mapping.priority,
          description: mapping.description
        });

        totalBooks += collectionData.totalBooks;
        totalHadith += collectionData.totalHadith;
      }
    });

    const index = {
      hadith: {
        version: "1.0.0",
        lastUpdated: new Date().toISOString(),
        totalCollections: collections.length,
        totalBooks: totalBooks,
        totalHadith: totalHadith,
        languages: {
          translations: ["en", "ur", "fr", "id", "tr"],
          transliterations: ["en"]
        }
      },
      collections: collections,
      loadingStrategy: {
        priority1: collections.filter(c => c.priority === 1).map(c => c.name),
        priority2: collections.filter(c => c.priority === 2).map(c => c.name),
        priority3: collections.filter(c => c.priority === 3).map(c => c.name)
      }
    };

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    console.log('✅ Updated hadith index successfully');
  }

  generateExtractionReport() {
    const report = {
      timestamp: new Date().toISOString(),
      extraction: {
        collectionsProcessed: this.stats.collectionsProcessed,
        hadithExtracted: this.stats.hadithExtracted,
        booksCreated: this.stats.booksCreated,
        errors: this.stats.errors.length,
        errorDetails: this.stats.errors
      },
      collections: Object.keys(this.collectionMapping).map(source => ({
        source: source,
        target: this.collectionMapping[source].target,
        status: this.stats.errors.some(e => e.includes(source)) ? 'error' : 'success'
      })),
      recommendations: [
        "Validate extracted files against schema",
        "Add English translations if available",
        "Consider adding commentary/explanations",
        "Implement search indexing for hadith text"
      ]
    };

    const reportPath = path.join(__dirname, '..', 'reports', 'hadith-extraction-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n📋 EXTRACTION SUMMARY');
    console.log('====================');
    console.log(`✅ Collections processed: ${this.stats.collectionsProcessed}`);
    console.log(`✅ Hadith extracted: ${this.stats.hadithExtracted}`);
    console.log(`✅ Books created: ${this.stats.booksCreated}`);

    if (this.stats.errors.length > 0) {
      console.log(`⚠️ Errors: ${this.stats.errors.length} (see report for details)`);
    }

    console.log(`📊 Report saved: ${reportPath}`);
    console.log('\n🎉 Hadith extraction completed successfully!');
  }
}

// Run extraction if called directly
if (require.main === module) {
  const extractor = new HadithExtractor();
  extractor.extractAllHadith().catch(console.error);
}

module.exports = HadithExtractor;