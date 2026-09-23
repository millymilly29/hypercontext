/**
 * HYPERCONTEXT // Multi-File Semantic Blast Radius Analyzer
 * Analyzes cross-file dependency ripples and tracks breaking changes across monorepo boundaries.
 */

class BlastRadiusAnalyzer {
  /**
   * @param {Array<{ path: string, content: string }>} files 
   */
  constructor(files = []) {
    // Forward graph: Map<file, Set<importedFile>>
    this.forwardGraph = new Map();
    // Reverse graph: Map<file, Set<dependentFile>>
    this.reverseGraph = new Map();
    // File metadata
    this.files = new Map();

    if (files.length > 0) {
      this.buildGraph(files);
    }
  }

  /**
   * Builds the dependency graph from a collection of source files.
   * @param {Array<{ path: string, content: string }>} files 
   */
  buildGraph(files) {
    this.forwardGraph.clear();
    this.reverseGraph.clear();
    this.files.clear();

    const filePaths = new Set(files.map(f => f.path));

    for (const f of files) {
      this.files.set(f.path, f);
      this.forwardGraph.set(f.path, new Set());
      if (!this.reverseGraph.has(f.path)) {
        this.reverseGraph.set(f.path, new Set());
      }
    }

    // Extract import statements
    for (const f of files) {
      const imports = this._extractImports(f.content, f.path, filePaths);
      for (const target of imports) {
        this.forwardGraph.get(f.path).add(target);
        if (!this.reverseGraph.has(target)) {
          this.reverseGraph.set(target, new Set());
        }
        this.reverseGraph.get(target).add(f.path);
      }
    }
  }

  /**
   * Resolves the transitive blast radius if targetFile is modified.
   * 
   * @param {string} targetFile 
   * @returns {{ target: string, directImpact: string[], transitiveImpact: string[], totalAffected: number, riskScore: number, affectedRoutes: string[] }}
   */
  analyze(targetFile) {
    if (!this.files.has(targetFile)) {
      // Fuzzy match
      const matched = Array.from(this.files.keys()).find(k => k.includes(targetFile));
      if (matched) targetFile = matched;
    }

    const direct = Array.from(this.reverseGraph.get(targetFile) || []);
    const visited = new Set([targetFile, ...direct]);
    const queue = [...direct];
    const transitive = [];

    while (queue.length > 0) {
      const current = queue.shift();
      const dependents = this.reverseGraph.get(current) || [];
      for (const dep of dependents) {
        if (!visited.has(dep)) {
          visited.add(dep);
          transitive.push(dep);
          queue.push(dep);
        }
      }
    }

    const totalAffected = direct.length + transitive.length;
    // Risk score 0 to 100 based on affected count and critical path triggers
    const isCore = targetFile.includes('auth') || targetFile.includes('db') || targetFile.includes('model');
    const riskScore = Math.min(100, (totalAffected * 12) + (isCore ? 35 : 10));

    const allAffected = [...direct, ...transitive];
    const affectedRoutes = allAffected.filter(p => p.includes('route') || p.includes('controller') || p.includes('api'));

    return {
      target: targetFile,
      directImpact: direct,
      transitiveImpact: transitive,
      totalAffected,
      riskScore,
      affectedRoutes
    };
  }

  /**
   * Resolves relative import strings to target project files.
   */
  _extractImports(content, currentPath, allPaths) {
    const targets = new Set();
    // Match import ... from '...' or require('...')
    const regex = /(?:import\s+(?:[\w*\s{},]+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const importPath = match[1] || match[2];
      if (!importPath || !importPath.startsWith('.')) continue;

      // Normalize candidate target paths
      const currentDir = currentPath.split('/').slice(0, -1).join('/');
      const combined = this._normalizePath(`${currentDir}/${importPath}`);

      const candidates = [
        combined,
        `${combined}.ts`,
        `${combined}.js`,
        `${combined}.tsx`,
        `${combined}.jsx`,
        `${combined}/index.ts`,
        `${combined}/index.js`
      ];

      for (const cand of candidates) {
        if (allPaths.has(cand)) {
          targets.add(cand);
          break;
        }
      }
    }

    return Array.from(targets);
  }

  _normalizePath(p) {
    const parts = p.split('/').filter(Boolean);
    const resolved = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        resolved.pop();
      } else {
        resolved.push(part);
      }
    }
    return resolved.join('/');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BlastRadiusAnalyzer };
}
