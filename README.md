# JustDeen Data - Islamic Content Repository

A comprehensive, mobile-optimized Islamic content repository providing Quran, Hadith, Duas, and Tafsir data via GitHub CDN. Designed for Islamic mobile applications with multilingual support and offline-first architecture.

## 🌟 Features

- **Mobile-Optimized**: Chapter/book-based structure for efficient loading
- **Multilingual Support**: Arabic + 5 languages (English, Urdu, French, Indonesian, Turkish)
- **CDN Delivery**: High-performance content delivery via jsDelivr/GitHub CDN
- **Offline-First**: Smart caching and priority loading strategies
- **Dynamic Language Discovery**: No app updates needed for new languages
- **JSON Schema Validation**: Ensured data integrity and consistency
- **Compression Ready**: 65% size reduction potential with gzip

## 📊 Content Overview

| Content Type | Total Items | Languages | Status |
|--------------|-------------|-----------|--------|
| **Quran** | 114 chapters, 6,236 verses | Arabic + English | ✅ Complete |
| **Hadith** | 34,532 hadith in 6 collections | Arabic + 5 languages | ✅ Complete |
| **Duas** | 97 duas in 5 categories | Arabic + English + Transliteration | ✅ Complete |
| **Tafsir** | Coming soon | Arabic + English + Urdu | 🚧 Planned |

## 🚀 Quick Start

### CDN Base URLs

```
Primary: https://cdn.jsdelivr.net/gh/yourusername/justdeen-data@main/
Backup:  https://raw.githubusercontent.com/yourusername/justdeen-data/main/
```

### Dynamic Metadata Discovery

Always start by fetching the metadata to get current language support:

```dart
// Flutter example
const metadataUrl = 'https://cdn.jsdelivr.net/gh/yourusername/justdeen-data@main/metadata.json';
final metadata = await http.get(Uri.parse(metadataUrl));
```

## 📱 Flutter Integration Examples

### 1. Islamic Content Service

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class IslamicContentService {
  static const String baseUrl = 'https://cdn.jsdelivr.net/gh/yourusername/justdeen-data@main/';

  // Cache for metadata and content
  Map<String, dynamic>? _metadata;
  final Map<String, dynamic> _cache = {};

  // Get available languages dynamically
  Future<Map<String, dynamic>> getMetadata() async {
    if (_metadata != null) return _metadata!;

    final response = await http.get(Uri.parse('${baseUrl}metadata.json'));
    if (response.statusCode == 200) {
      _metadata = json.decode(response.body);
      return _metadata!;
    }
    throw Exception('Failed to load metadata');
  }

  // Get supported languages for a content type
  Future<List<String>> getSupportedLanguages(String contentType) async {
    final metadata = await getMetadata();
    final content = metadata['content'][contentType];

    List<String> languages = ['ar']; // Arabic always available

    if (content['languages']['translations'] != null) {
      languages.addAll(
        content['languages']['translations'].keys.cast<String>()
      );
    }

    return languages;
  }
}
```

### 2. Quran Service

```dart
class QuranService extends IslamicContentService {
  // Load Quran index
  Future<Map<String, dynamic>> getQuranIndex() async {
    const cacheKey = 'quran_index';

    if (_cache.containsKey(cacheKey)) {
      return _cache[cacheKey];
    }

    final response = await http.get(Uri.parse('${baseUrl}data/quran/index.json'));
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      _cache[cacheKey] = data;
      return data;
    }
    throw Exception('Failed to load Quran index');
  }

  // Load specific chapter
  Future<Map<String, dynamic>> getChapter(int chapterNumber) async {
    final cacheKey = 'chapter_$chapterNumber';

    if (_cache.containsKey(cacheKey)) {
      return _cache[cacheKey];
    }

    final paddedNumber = chapterNumber.toString().padLeft(3, '0');
    final response = await http.get(
      Uri.parse('${baseUrl}data/quran/chapters/$paddedNumber.json')
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      _cache[cacheKey] = data;
      return data;
    }
    throw Exception('Failed to load chapter $chapterNumber');
  }

  // Get verse with specific translation
  Future<Map<String, dynamic>> getVerse(int chapter, int verse, [String? translation]) async {
    final chapterData = await getChapter(chapter);
    final verses = chapterData['content'] as List;

    final verseData = verses.firstWhere(
      (v) => v['verse'] == verse,
      orElse: () => throw Exception('Verse not found')
    );

    return verseData;
  }

  // Search verses
  Future<List<Map<String, dynamic>>> searchVerses(String query, [String language = 'en']) async {
    // Implementation for verse search
    // You would typically load multiple chapters and search through them
    final results = <Map<String, dynamic>>[];

    // Example: Search through Al-Fatihah
    final chapter = await getChapter(1);
    final verses = chapter['content'] as List;

    for (final verse in verses) {
      final text = verse['translations']?[language] ?? verse['arabic'];
      if (text.toLowerCase().contains(query.toLowerCase())) {
        results.add({
          'chapter': 1,
          'verse': verse['verse'],
          'text': text,
          'arabic': verse['arabic']
        });
      }
    }

    return results;
  }
}
```

### 3. Hadith Service

```dart
class HadithService extends IslamicContentService {
  // Get hadith collections
  Future<Map<String, dynamic>> getHadithIndex() async {
    const cacheKey = 'hadith_index';

    if (_cache.containsKey(cacheKey)) {
      return _cache[cacheKey];
    }

    final response = await http.get(Uri.parse('${baseUrl}data/hadith/index.json'));
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      _cache[cacheKey] = data;
      return data;
    }
    throw Exception('Failed to load hadith index');
  }

  // Get specific collection info
  Future<Map<String, dynamic>> getCollection(String collection) async {
    final cacheKey = 'collection_$collection';

    if (_cache.containsKey(cacheKey)) {
      return _cache[cacheKey];
    }

    final response = await http.get(
      Uri.parse('${baseUrl}data/hadith/collections/$collection/collection.json')
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      _cache[cacheKey] = data;
      return data;
    }
    throw Exception('Failed to load collection $collection');
  }

  // Get specific book
  Future<Map<String, dynamic>> getBook(String collection, int bookNumber) async {
    final cacheKey = 'book_${collection}_$bookNumber';

    if (_cache.containsKey(cacheKey)) {
      return _cache[cacheKey];
    }

    final paddedNumber = bookNumber.toString().padLeft(3, '0');
    final response = await http.get(
      Uri.parse('${baseUrl}data/hadith/collections/$collection/book-$paddedNumber.json')
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      _cache[cacheKey] = data;
      return data;
    }
    throw Exception('Failed to load book $bookNumber from $collection');
  }

  // Get hadith with multiple language support
  Future<Map<String, dynamic>> getHadith(String collection, int hadithNumber, [List<String>? languages]) async {
    // This would require implementing a hadith number to book mapping
    // For now, search through books
    final collectionData = await getCollection(collection);

    // Search through books to find the hadith
    for (int bookNum = 1; bookNum <= collectionData['totalBooks']; bookNum++) {
      try {
        final book = await getBook(collection, bookNum);
        final hadithList = book['content'] as List;

        final hadith = hadithList.firstWhere(
          (h) => h['hadithNumber'] == hadithNumber,
          orElse: () => null
        );

        if (hadith != null) {
          // Filter languages if specified
          if (languages != null && hadith['text']['translations'] != null) {
            final filteredTranslations = <String, dynamic>{};
            for (final lang in languages) {
              if (hadith['text']['translations'][lang] != null) {
                filteredTranslations[lang] = hadith['text']['translations'][lang];
              }
            }
            hadith['text']['translations'] = filteredTranslations;
          }

          return hadith;
        }
      } catch (e) {
        // Continue searching in next book
        continue;
      }
    }

    throw Exception('Hadith $hadithNumber not found in $collection');
  }
}
```

### 4. Duas Service

```dart
class DuasService extends IslamicContentService {
  // Get duas index
  Future<Map<String, dynamic>> getDuasIndex() async {
    const cacheKey = 'duas_index';

    if (_cache.containsKey(cacheKey)) {
      return _cache[cacheKey];
    }

    final response = await http.get(Uri.parse('${baseUrl}data/duas/index.json'));
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      _cache[cacheKey] = data;
      return data;
    }
    throw Exception('Failed to load duas index');
  }

  // Get duas by category
  Future<Map<String, dynamic>> getDuasCategory(String category) async {
    final cacheKey = 'duas_$category';

    if (_cache.containsKey(cacheKey)) {
      return _cache[cacheKey];
    }

    final response = await http.get(
      Uri.parse('${baseUrl}data/duas/categories/$category.json')
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      _cache[cacheKey] = data;
      return data;
    }
    throw Exception('Failed to load duas category $category');
  }

  // Get duas by occasion
  Future<List<Map<String, dynamic>>> getDuasByOccasion(String occasion) async {
    final index = await getDuasIndex();
    final categories = index['categories'] as List;
    final results = <Map<String, dynamic>>[];

    for (final category in categories) {
      final occasions = category['occasions'] as List;
      if (occasions.contains(occasion)) {
        final categoryData = await getDuasCategory(category['id']);
        final duas = categoryData['content'] as List;

        final filteredDuas = duas.where((dua) => dua['occasion'] == occasion).toList();
        results.addAll(filteredDuas.cast<Map<String, dynamic>>());
      }
    }

    return results;
  }
}
```

### 5. Complete Islamic App Service

```dart
class IslamicAppService {
  late final QuranService _quranService;
  late final HadithService _hadithService;
  late final DuasService _duasService;

  IslamicAppService() {
    _quranService = QuranService();
    _hadithService = HadithService();
    _duasService = DuasService();
  }

  // Initialize app with metadata
  Future<Map<String, dynamic>> initialize() async {
    return await _quranService.getMetadata();
  }

  // Get supported languages for all content types
  Future<Map<String, List<String>>> getAllSupportedLanguages() async {
    final metadata = await _quranService.getMetadata();
    final result = <String, List<String>>{};

    for (final contentType in ['quran', 'hadith', 'duas']) {
      result[contentType] = await _quranService.getSupportedLanguages(contentType);
    }

    return result;
  }

  // Priority loading for offline support
  Future<void> preloadEssentialContent([String language = 'en']) async {
    // Load essential Quran chapters
    final essentialChapters = [1, 2, 18, 36, 67, 112, 113, 114]; // Al-Fatihah, Al-Baqarah, Al-Kahf, etc.

    for (final chapter in essentialChapters) {
      await _quranService.getChapter(chapter);
    }

    // Load essential hadith books
    await _hadithService.getBook('bukhari', 1); // Book of Revelation
    await _hadithService.getBook('muslim', 1);  // Book of Faith

    // Load daily duas
    await _duasService.getDuasCategory('daily');
  }
}
```

## 🌐 CDN URL Patterns

### Quran URLs
```
Index:    {baseUrl}data/quran/index.json
Chapters: {baseUrl}data/quran/chapters/{001-114}.json

Examples:
- https://cdn.jsdelivr.net/gh/yourusername/justdeen-data@main/data/quran/index.json
- https://cdn.jsdelivr.net/gh/yourusername/justdeen-data@main/data/quran/chapters/001.json
- https://cdn.jsdelivr.net/gh/yourusername/justdeen-data@main/data/quran/chapters/114.json
```

### Hadith URLs
```
Index:      {baseUrl}data/hadith/index.json
Collection: {baseUrl}data/hadith/collections/{collection}/collection.json
Books:      {baseUrl}data/hadith/collections/{collection}/book-{001-999}.json

Collections: bukhari, muslim, abudawud, tirmidhi, nasai, majah

Examples:
- https://cdn.jsdelivr.net/gh/yourusername/justdeen-data@main/data/hadith/index.json
- https://cdn.jsdelivr.net/gh/yourusername/justdeen-data@main/data/hadith/collections/bukhari/collection.json
- https://cdn.jsdelivr.net/gh/yourusername/justdeen-data@main/data/hadith/collections/bukhari/book-001.json
```

### Duas URLs
```
Index:      {baseUrl}data/duas/index.json
Categories: {baseUrl}data/duas/categories/{category}.json

Categories: daily, morning, evening, prayer, essential

Examples:
- https://cdn.jsdelivr.net/gh/yourusername/justdeen-data@main/data/duas/index.json
- https://cdn.jsdelivr.net/gh/yourusername/justdeen-data@main/data/duas/categories/daily.json
```

### Metadata URLs
```
Metadata: {baseUrl}metadata.json

Example:
- https://cdn.jsdelivr.net/gh/yourusername/justdeen-data@main/metadata.json
```

## 🎯 Smart Caching Strategy

### Recommended Cache TTLs
```dart
const cacheTTL = {
  'metadata': Duration(days: 1),     // 24 hours
  'index': Duration(days: 7),       // 1 week
  'content': Duration(days: 30),    // 1 month
};
```

### Priority Loading Order
1. **Essential**: Al-Fatihah, Daily Duas, Hadith Book 1 (Faith)
2. **Popular**: Most-read chapters, Essential Hadith collections
3. **Complete**: Full content as needed

## 🔧 Data Structure Examples

### Quran Chapter Structure
```json
{
  "chapter": 1,
  "name": {
    "arabic": "الفاتحة",
    "transliteration": "Al-Fatihah",
    "translation": "The Opening"
  },
  "content": [
    {
      "verse": 1,
      "arabic": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
      "translations": {
        "en.sahih": "In the name of Allah, the Entirely Merciful..."
      }
    }
  ]
}
```

### Hadith Structure
```json
{
  "hadithNumber": 1,
  "text": {
    "arabic": "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ...",
    "translations": {
      "en": "Actions are but by intention...",
      "ur": "تمام اعمال کا دارومدار نیت پر ہے...",
      "fr": "Les actions ne valent que par les intentions...",
      "id": "Sesungguhnya amal itu tergantung niatnya...",
      "tr": "Ameller ancak niyetlere göredir..."
    }
  },
  "narrator": {
    "en": "Umar bin Al-Khattab"
  }
}
```

### Duas Structure
```json
{
  "id": "daily-01",
  "occasion": "morning",
  "name": {
    "arabic": "دعاء الاستيقاظ",
    "transliteration": "Du'a al-Istiqadh",
    "translation": "Supplication Upon Waking"
  },
  "arabic": "الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا...",
  "transliteration": "Alhamdu lillahi alladhi ahyana...",
  "translation": {
    "en": "Praise be to Allah who has given us life..."
  }
}
```

## 🌍 Adding New Languages

### For Contributors

1. **Check Metadata**: First check `metadata.json` for current language support
2. **Add Source Data**: Place translation files in appropriate source format
3. **Update Scripts**: Run extraction scripts with new language support
4. **Update Metadata**: Add language info to `metadata.json`
5. **Validate**: Ensure all files pass JSON schema validation

### Language Addition Example

```bash
# For Hadith
node scripts/enhance-hadith-multilingual.js

# For Duas
node scripts/extract-duas.js

# Update metadata
# Edit metadata.json to include new language
```

### Mobile App Dynamic Language Support

```dart
class LanguageManager {
  static Future<List<String>> getAvailableLanguages(String contentType) async {
    final service = IslamicContentService();
    return await service.getSupportedLanguages(contentType);
  }

  static Future<bool> isLanguageSupported(String contentType, String languageCode) async {
    final languages = await getAvailableLanguages(contentType);
    return languages.contains(languageCode);
  }

  // Automatically adapt to new languages without app updates
  static Future<String> getBestAvailableLanguage(String contentType, String preferred) async {
    final available = await getAvailableLanguages(contentType);

    if (available.contains(preferred)) {
      return preferred;
    }

    // Fallback logic
    if (available.contains('en')) return 'en';
    if (available.contains('ar')) return 'ar';

    return available.first;
  }
}
```

## 📋 Content Statistics

- **Total File Size**: ~104MB (down from 219MB - 52% reduction)
- **Potential Compression**: Additional 65% with gzip
- **Total Files**: 485 (vs 31,374 original - 99.6% reduction)
- **Languages**: 5 active (Arabic + 4 translations)
- **CDN Performance**: ~99.9% uptime via jsDelivr

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Adding new languages
- Improving data quality
- Reporting issues
- Code contributions

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Hadith data sourced from hadith-api-1
- Dua data from dua-dhikr-main
- Quran text from multiple verified sources
- CDN provided by jsDelivr and GitHub

---

**Made with ❤️ for the Muslim Ummah**