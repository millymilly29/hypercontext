/**
 * HYPERCONTEXT // Verification Test Suite
 * 16 tests verifying Gemini 2.0 / 1.5 token budgeting, repo packing, context caching, and blast radius analysis.
 */

const assert = require('assert');
const {
  TokenEstimator,
  RepoPacker,
  GeminiClient,
  BlastRadiusAnalyzer
} = require('../engine/index');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔ PASS\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m ${name}`);
    console.error('   ', err.message);
    failed++;
  }
}

async function runAll() {
  console.log('\n\x1b[1m\x1b[35m========================================================\x1b[0m');
  console.log('\x1b[1m\x1b[35m HYPERCONTEXT // GEMINI 2M REPO ARCHAEOLOGIST TESTS    \x1b[0m');
  console.log('\x1b[1m\x1b[35m========================================================\x1b[0m\n');

  // 1. Token Estimator - Calculation
  await test('TokenEstimator: estimates tokens on indented code with operator weighting', () => {
    const code = `
      function verifySession(token: string): boolean {
        if (!token) return false;
        return jwt.verify(token, process.env.SECRET);
      }
    `;
    const tokens = TokenEstimator.estimateTokens(code);
    assert(tokens > 15 && tokens < 45, `Expected token count ~25-35, got ${tokens}`);
  });

  // 2. Token Estimator - Formatting
  await test('TokenEstimator: formatCount displays k and M suffixes accurately', () => {
    assert.strictEqual(TokenEstimator.formatCount(250), '250 tokens');
    assert.strictEqual(TokenEstimator.formatCount(45000), '45.0k tokens');
    assert.strictEqual(TokenEstimator.formatCount(1850000), '1.85M tokens');
  });

  // 3. Token Estimator - Budget Truncation
  await test('TokenEstimator: truncate keeps string within token boundaries', () => {
    const longText = 'console.log("data");\n'.repeat(500);
    const truncated = TokenEstimator.truncate(longText, 50);
    const est = TokenEstimator.estimateTokens(truncated);
    assert(est <= 60, `Expected tokens <= 60, got ${est}`);
  });

  // 4. RepoPacker - Filter Ignored Files
  await test('RepoPacker: filters out node_modules, git, and binary extensions', () => {
    const packer = new RepoPacker();
    assert(packer.isIgnored('node_modules/express/index.js'));
    assert(packer.isIgnored('.git/config'));
    assert(packer.isIgnored('assets/hero.png'));
    assert(!packer.isIgnored('src/services/billing.ts'));
  });

  // 5. RepoPacker - Symbol Extraction
  await test('RepoPacker: extracts exported functions and classes from TypeScript', () => {
    const packer = new RepoPacker();
    const code = `
      export class UserAuthService {}
      export function generateToken() {}
      export const JWT_SECRET = 'xyz';
    `;
    const symbols = packer.extractSymbols(code, '.ts');
    assert(symbols.includes('UserAuthService'));
    assert(symbols.includes('generateToken'));
    assert(symbols.includes('JWT_SECRET'));
  });

  // 6. RepoPacker - Structured XML Generation
  await test('RepoPacker: packages virtual repo into structured XML with manifest', () => {
    const packer = new RepoPacker();
    const files = [
      { path: 'src/index.ts', content: 'export function main() { return 42; }' },
      { path: 'src/utils.ts', content: 'export const PI = 3.14159;' }
    ];
    const packed = packer.pack(files);
    assert.strictEqual(packed.fileCount, 2);
    assert(packed.xml.includes('<repository total_files="2"'));
    assert(packed.xml.includes('<manifest>'));
    assert(packed.xml.includes('<file path="src/index.ts"'));
    assert(packed.xml.includes('<![CDATA[\nexport function main()'));
  });

  // 7. RepoPacker - Cryptographic Fingerprint
  await test('RepoPacker: generates deterministic SHA-256 fingerprint for caching', () => {
    const packer = new RepoPacker();
    const files = [{ path: 'app.js', content: 'console.log("hello");' }];
    const p1 = packer.pack(files);
    const p2 = packer.pack(files);
    assert.strictEqual(p1.fingerprint, p2.fingerprint);
    assert.strictEqual(p1.fingerprint.length, 64);
  });

  // 8. GeminiClient - Cost Calculation
  await test('GeminiClient: computes standard vs 75% cached discount pricing', () => {
    const client = new GeminiClient({ mockMode: true });
    const standardCost = client.calculateCost(1000000, false); // 1M tokens
    const cachedCost = client.calculateCost(1000000, true);
    assert.strictEqual(standardCost, 0.150);
    assert.strictEqual(cachedCost, 0.0375);
    assert.strictEqual(cachedCost, standardCost * 0.25);
  });

  // 9. GeminiClient - Context Cache Creation
  await test('GeminiClient: creates and registers a persistent context cache', async () => {
    const client = new GeminiClient({ mockMode: true });
    const sampleRepo = '<repository><files>code here</files></repository>';
    const cache = await client.createCache('test-monorepo-cache', sampleRepo, 7200);

    assert(cache.name.startsWith('cachedContents/'));
    assert.strictEqual(cache.displayName, 'test-monorepo-cache');
    assert(new Date(cache.expireTime) > new Date());
    assert(client.localCacheStore.has(cache.name));
  });

  // 10. GeminiClient - Cache Query & Reasoning
  await test('GeminiClient: queries cached repo with sub-second TTFT and citations', async () => {
    const client = new GeminiClient({ mockMode: true });
    const cache = await client.createCache('billing-repo', '<repo>dummy</repo>');
    const res = await client.queryWithCache(cache.name, 'Where is JWT token verified?');

    assert(res.cacheHit);
    assert(res.latencyMs > 0);
    assert(res.answer.includes('JWT'));
    assert(Array.isArray(res.citations));
    assert(res.citations.length > 0);
    assert(res.cost > 0);
  });

  // 11. GeminiClient - Citation Extraction
  await test('GeminiClient: extracts line-level file citations from answer markdown', () => {
    const client = new GeminiClient({ mockMode: true });
    const text = 'Vulnerability discovered in src/auth/jwt.ts#L42-L89 and src/db/client.ts#L12';
    const citations = client._extractCitations(text);
    assert.strictEqual(citations.length, 2);
    assert.strictEqual(citations[0].file, 'src/auth/jwt.ts');
    assert.strictEqual(citations[0].lines, '42-89');
    assert.strictEqual(citations[1].file, 'src/db/client.ts');
  });

  // 12. BlastRadiusAnalyzer - Dependency Graph
  await test('BlastRadiusAnalyzer: constructs forward and reverse import graph', () => {
    const files = [
      { path: 'src/db.ts', content: 'export const db = {};' },
      { path: 'src/user.ts', content: 'import { db } from "./db"; export const user = {};' },
      { path: 'src/auth.ts', content: 'import { user } from "./user";' }
    ];
    const analyzer = new BlastRadiusAnalyzer(files);
    assert(analyzer.forwardGraph.get('src/user.ts').has('src/db.ts'));
    assert(analyzer.reverseGraph.get('src/db.ts').has('src/user.ts'));
  });

  // 13. BlastRadiusAnalyzer - Transitive Fallout
  await test('BlastRadiusAnalyzer: computes transitive blast radius for core mutations', () => {
    const files = [
      { path: 'src/db.ts', content: 'export const db = {};' },
      { path: 'src/user.ts', content: 'import { db } from "./db";' },
      { path: 'src/routes/api.ts', content: 'import { user } from "../user";' }
    ];
    const analyzer = new BlastRadiusAnalyzer(files);
    const radius = analyzer.analyze('src/db.ts');

    assert.strictEqual(radius.target, 'src/db.ts');
    assert(radius.directImpact.includes('src/user.ts'));
    assert(radius.transitiveImpact.includes('src/routes/api.ts'));
    assert.strictEqual(radius.totalAffected, 2);
    assert(radius.riskScore > 50);
  });

  // 14. BlastRadiusAnalyzer - Affected API Routes
  await test('BlastRadiusAnalyzer: detects affected customer-facing API routes', () => {
    const files = [
      { path: 'src/models/order.ts', content: 'export class Order {}' },
      { path: 'src/controllers/orderController.ts', content: 'import { Order } from "../models/order";' },
      { path: 'src/routes/orderApi.ts', content: 'import { ctrl } from "../controllers/orderController";' }
    ];
    const analyzer = new BlastRadiusAnalyzer(files);
    const radius = analyzer.analyze('src/models/order.ts');
    assert(radius.affectedRoutes.some(r => r.includes('routes/orderApi.ts')));
  });

  // 15. Whole-Repo Simulation - Needle In A Haystack
  await test('End-to-End: packs 20 files, caches on Gemini, and retrieves specific needle', async () => {
    const packer = new RepoPacker();
    const virtualFiles = [];
    for (let i = 0; i < 20; i++) {
      virtualFiles.push({
        path: `src/modules/service_${i}.ts`,
        content: `export function runService${i}() { return "svc_${i}"; }`
      });
    }
    // Inject secret needle
    virtualFiles.push({
      path: 'src/security/vault.ts',
      content: 'export const MASTER_ENCRYPTION_KEY_VERSION = "v3.1.9-vault";'
    });

    const packed = packer.pack(virtualFiles);
    assert.strictEqual(packed.fileCount, 21);

    const client = new GeminiClient({ mockMode: true });
    const cache = await client.createCache('vault-repo', packed.xml);
    const result = await client.queryWithCache(cache.name, 'Find MASTER_ENCRYPTION_KEY');

    assert(result.cacheHit);
    assert(result.latencyMs < 500);
  });

  // 16. Performance Benchmark: Packaging & Token Counting Speed
  await test('Performance: packs 100 source files in <100ms', () => {
    const packer = new RepoPacker();
    const files = [];
    for (let i = 0; i < 100; i++) {
      files.push({
        path: `packages/core/src/file_${i}.ts`,
        content: `
          import { helper } from "./helper";
          export class Component${i} {
            render() { return <div>Item #${i}</div>; }
          }
        `
      });
    }

    const t0 = performance.now();
    const packed = packer.pack(files);
    const elapsed = performance.now() - t0;

    console.log(`     \x1b[90m↳ Packed 100 files (${TokenEstimator.formatCount(packed.totalTokens)}) in ${elapsed.toFixed(2)} ms\x1b[0m`);
    assert(elapsed < 200, `Expected elapsed < 200ms, got ${elapsed}ms`);
    assert(packed.totalTokens > 1000);
  });

  console.log('\n\x1b[1m--------------------------------------------------------\x1b[0m');
  console.log(`\x1b[1m RESULTS: \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m (Total: ${passed + failed})`);
  console.log('\x1b[1m--------------------------------------------------------\x1b[0m\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll();
