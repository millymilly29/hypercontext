/**
 * HYPERCONTEXT // Repository Packer & AST Symbol Outliner
 * Synthesizes multi-file codebases into structured 2M-token Gemini prompt payloads.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { TokenEstimator } = require('./token-estimator');

class RepoPacker {
  /**
   * @param {Object} [options]
   * @param {string[]} [options.ignorePatterns]
   * @param {number} [options.maxFileSizeBytes=500000]
   */
  constructor(options = {}) {
    this.ignorePatterns = options.ignorePatterns || [
      'node_modules', '.git', '.DS_Store', 'dist', 'build', 'coverage',
      'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
      '.next', '.nuxt', '.turbo', '.cache'
    ];
    this.binaryExtensions = new Set([
      '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf',
      '.zip', '.tar', '.gz', '.mp3', '.mp4', '.mov', '.woff', '.woff2', '.ttf'
    ]);
    this.maxFileSizeBytes = options.maxFileSizeBytes || 500000;
  }

  /**
   * Checks if a relative path should be excluded.
   * @param {string} relPath 
   * @returns {boolean}
   */
  isIgnored(relPath) {
    const parts = relPath.split(path.sep);
    for (const part of parts) {
      if (this.ignorePatterns.includes(part)) return true;
    }
    const ext = path.extname(relPath).toLowerCase();
    if (this.binaryExtensions.has(ext)) return true;
    return false;
  }

  /**
   * Extracts top-level exports and symbols from source code.
   * @param {string} content 
   * @param {string} ext 
   * @returns {string[]}
   */
  extractSymbols(content, ext) {
    const symbols = [];
    if (!['.js', '.ts', '.jsx', '.tsx', '.py', '.rs', '.go'].includes(ext)) {
      return symbols;
    }

    // JS/TS exports
    const exportMatches = content.matchAll(/export\s+(?:default\s+)?(?:class|function|const|let|var|type|interface|enum)\s+([a-zA-Z0-9_$]+)/g);
    for (const m of exportMatches) {
      symbols.push(m[1]);
    }

    // Python def/class
    if (ext === '.py') {
      const pyMatches = content.matchAll(/^(?:def|class)\s+([a-zA-Z0-9_]+)/gm);
      for (const m of pyMatches) symbols.push(m[1]);
    }

    return symbols.slice(0, 15);
  }

  /**
   * Packs an array of in-memory virtual files or scans a physical directory.
   * 
   * @param {string|Array<{ path: string, content: string }>} source 
   * @returns {{ xml: string, fileCount: number, totalTokens: number, fingerprint: string, fileTree: Array<Object> }}
   */
  pack(source) {
    let files = [];

    if (typeof source === 'string') {
      files = this._scanDir(source, source);
    } else if (Array.isArray(source)) {
      files = source.filter(f => !this.isIgnored(f.path));
    }

    let totalTokens = 0;
    const fileEntries = [];
    const treeOutlines = [];

    for (const f of files) {
      const ext = path.extname(f.path).toLowerCase();
      const tokens = TokenEstimator.estimateTokens(f.content);
      const symbols = this.extractSymbols(f.content, ext);

      totalTokens += tokens;
      fileEntries.push({
        path: f.path,
        tokens,
        symbols,
        content: f.content
      });

      treeOutlines.push({
        path: f.path,
        tokens,
        symbols
      });
    }

    // Build XML payload formatted for optimal Gemini retrieval
    let xml = `<repository total_files="${fileEntries.length}" total_tokens="${totalTokens}">\n`;
    
    // 1. File Tree with symbol manifest
    xml += `  <manifest>\n`;
    for (const item of treeOutlines) {
      const symStr = item.symbols.length ? ` symbols="${item.symbols.join(', ')}"` : '';
      xml += `    <file path="${item.path}" tokens="${item.tokens}"${symStr}/>\n`;
    }
    xml += `  </manifest>\n`;

    // 2. Full File Contents
    xml += `  <sources>\n`;
    for (const f of fileEntries) {
      xml += `    <file path="${f.path}">\n`;
      xml += `<![CDATA[\n${f.content}\n]]>\n`;
      xml += `    </file>\n`;
    }
    xml += `  </sources>\n`;
    xml += `</repository>`;

    // Compute deterministic SHA-256 fingerprint for Gemini Context Caching
    const hash = crypto.createHash('sha256').update(xml).digest('hex');

    return {
      xml,
      fileCount: fileEntries.length,
      totalTokens,
      fingerprint: hash,
      fileTree: treeOutlines
    };
  }

  /**
   * Internal recursive scanner
   */
  _scanDir(dir, baseDir) {
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(baseDir, fullPath);

      if (this.isIgnored(relPath)) continue;

      if (entry.isDirectory()) {
        results = results.concat(this._scanDir(fullPath, baseDir));
      } else if (entry.isFile()) {
        const stats = fs.statSync(fullPath);
        if (stats.size > this.maxFileSizeBytes) continue;

        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          results.push({ path: relPath, content });
        } catch {
          // Skip unreadable files
        }
      }
    }
    return results;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RepoPacker };
}
