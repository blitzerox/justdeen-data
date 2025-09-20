#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

class IslamicDataOptimizer {
  constructor() {
    this.stats = {
      filesProcessed: 0,
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 0
    };
  }

  // Compress JSON files using gzip
  async compressFile(filePath) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const compressed = zlib.gzipSync(data);
      const compressedPath = filePath.replace('.json', '.json.gz');

      fs.writeFileSync(compressedPath, compressed);

      this.stats.originalSize += data.length;
      this.stats.compressedSize += compressed.length;
      this.stats.filesProcessed++;

      console.log(`✓ Compressed: ${path.basename(filePath)} (${this.getCompressionRatio(data.length, compressed.length)}% reduction)`);

      return compressedPath;
    } catch (error) {
      console.error(`✗ Error compressing ${filePath}:`, error.message);
      return null;
    }
  }

  // Optimize JSON structure by removing unnecessary whitespace
  optimizeJSON(filePath) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const optimized = JSON.stringify(data); // No pretty printing
      fs.writeFileSync(filePath, optimized);
      console.log(`✓ Optimized: ${path.basename(filePath)}`);
    } catch (error) {
      console.error(`✗ Error optimizing ${filePath}:`, error.message);
    }
  }

  // Create chapter bundles for efficient loading
  createChapterBundles() {
    console.log('🔧 Creating chapter bundles...');

    // Priority bundles for commonly read chapters
    const priority1 = [1, 67, 112, 113, 114]; // Fatihah, Mulk, Ikhlas, Falaq, Nas
    const priority2 = [18, 19, 20, 36, 48, 55, 56, 62, 78, 97]; // Kahf, Maryam, etc.

    this.createBundle('priority-1', priority1);
    this.createBundle('priority-2', priority2);
  }

  createBundle(name, chapters) {
    const bundle = {
      name,
      chapters: [],
      metadata: {
        totalChapters: chapters.length,
        totalVerses: 0,
        size: 0
      }
    };

    chapters.forEach(chapterNum => {
      const filePath = path.join(__dirname, '..', 'data', 'quran', 'chapters', `${chapterNum.toString().padStart(3, '0')}.json`);
      if (fs.existsSync(filePath)) {
        const chapterData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        bundle.chapters.push(chapterData);
        bundle.metadata.totalVerses += chapterData.verses;
      }
    });

    const bundlePath = path.join(__dirname, '..', 'data', 'quran', 'bundles', `${name}.json`);
    fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
    fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));

    console.log(`✓ Created bundle: ${name}.json (${bundle.chapters.length} chapters)`);
  }

  // Validate data integrity
  validateData() {
    console.log('🔍 Validating data integrity...');

    const errors = [];

    // Validate Quran structure
    this.validateQuranData(errors);

    // Validate Hadith structure
    this.validateHadithData(errors);

    // Validate Duas structure
    this.validateDuasData(errors);

    if (errors.length === 0) {
      console.log('✅ All data validation passed!');
    } else {
      console.error('❌ Validation errors found:');
      errors.forEach(error => console.error(`  - ${error}`));
    }

    return errors.length === 0;
  }

  validateQuranData(errors) {
    const indexPath = path.join(__dirname, '..', 'data', 'quran', 'index.json');
    if (!fs.existsSync(indexPath)) {
      errors.push('Missing Quran index.json');
      return;
    }

    try {
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      if (!index.chapters || index.chapters.length !== 114) {
        errors.push('Quran index should contain exactly 114 chapters');
      }
    } catch (e) {
      errors.push('Invalid Quran index.json format');
    }
  }

  validateHadithData(errors) {
    const indexPath = path.join(__dirname, '..', 'data', 'hadith', 'index.json');
    if (fs.existsSync(indexPath)) {
      try {
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        if (!index.collections || !Array.isArray(index.collections)) {
          errors.push('Hadith index should contain collections array');
        }
      } catch (e) {
        errors.push('Invalid Hadith index.json format');
      }
    }
  }

  validateDuasData(errors) {
    const indexPath = path.join(__dirname, '..', 'data', 'duas', 'index.json');
    if (fs.existsSync(indexPath)) {
      try {
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        if (!index.categories || !Array.isArray(index.categories)) {
          errors.push('Duas index should contain categories array');
        }
      } catch (e) {
        errors.push('Invalid Duas index.json format');
      }
    }
  }

  getCompressionRatio(original, compressed) {
    return Math.round(((original - compressed) / original) * 100);
  }

  // Generate size report
  generateSizeReport() {
    const report = {
      timestamp: new Date().toISOString(),
      statistics: this.stats,
      compressionRatio: Math.round(((this.stats.originalSize - this.stats.compressedSize) / this.stats.originalSize) * 100),
      recommendations: []
    };

    if (this.stats.compressionRatio < 50) {
      report.recommendations.push('Consider enabling gzip compression on CDN');
    }

    if (this.stats.originalSize > 50 * 1024 * 1024) { // 50MB
      report.recommendations.push('Consider splitting large files into smaller chunks');
    }

    const reportPath = path.join(__dirname, '..', 'reports', 'optimization-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('📊 Optimization report generated:', reportPath);
    return report;
  }

  // Run full optimization pipeline
  async run() {
    console.log('🚀 Starting Islamic Data Optimization...\n');

    // Step 1: Validate data
    if (!this.validateData()) {
      console.error('❌ Validation failed. Fix errors before optimizing.');
      process.exit(1);
    }

    // Step 2: Optimize JSON files
    console.log('\n📝 Optimizing JSON structure...');
    const dataDir = path.join(__dirname, '..', 'data');
    this.processDirectory(dataDir);

    // Step 3: Create bundles
    this.createChapterBundles();

    // Step 4: Generate report
    console.log('\n📊 Generating optimization report...');
    const report = this.generateSizeReport();

    console.log(`\n✅ Optimization complete!`);
    console.log(`📁 Files processed: ${this.stats.filesProcessed}`);
    console.log(`📉 Size reduction: ${report.compressionRatio}%`);
    console.log(`💾 Original size: ${Math.round(this.stats.originalSize / 1024)}KB`);
    console.log(`🗜️ Compressed size: ${Math.round(this.stats.compressedSize / 1024)}KB`);
  }

  processDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;

    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this.processDirectory(fullPath);
      } else if (entry.endsWith('.json') && !entry.endsWith('.min.json')) {
        this.optimizeJSON(fullPath);
      }
    }
  }
}

// Run optimizer if called directly
if (require.main === module) {
  const optimizer = new IslamicDataOptimizer();
  optimizer.run().catch(console.error);
}

module.exports = IslamicDataOptimizer;