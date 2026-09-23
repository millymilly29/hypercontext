#!/usr/bin/env node

/**
 * HYPERCONTEXT // CLI Interface
 * 2,000,000-Token Monorepo Intelligence & Gemini Context Caching Gateway
 */

const path = require('path');
const { RepoPacker } = require('./engine/repo-packer');
const { GeminiClient } = require('./engine/gemini-client');
const { BlastRadiusAnalyzer } = require('./engine/blast-radius');
const { TokenEstimator } = require('./engine/token-estimator');

const SAMPLE_MONOREPO_FILES = [
  { path: 'src/db/client.ts', content: 'export const dbClient = { query: (q: string) => [] };' },
  { path: 'src/models/user.ts', content: 'import { dbClient } from "../db/client"; export interface User { id: string; role: string; }' },
  { path: 'src/auth/jwt.ts', content: 'import { User } from "../models/user"; export function verifyJwt(token: string) { return true; }' },
  { path: 'src/middleware/auth.ts', content: 'import { verifyJwt } from "../auth/jwt"; export function authMiddleware(req: any) {}' },
  { path: 'src/routes/api/users.ts', content: 'import { authMiddleware } from "../../middleware/auth"; export const userRouter = {};' },
  { path: 'src/services/billing.ts', content: 'import { dbClient } from "../db/client"; export class BillingService {}' },
  { path: 'src/webhooks/stripe.ts', content: 'import { BillingService } from "../services/billing"; export function handleStripeEvent() {}' },
  { path: 'src/routes/internal/sync.ts', content: 'import { dbClient } from "../../db/client"; export function syncTenant() {}' }
];

function printBanner() {
  console.log(`
\x1b[35m   ██╗  ██╗██╗   ██╗██████╗ ███████╗██████╗  ██████╗ ██████╗ ███╗   ██╗████████╗███████╗██╗  ██╗████████╗
   ██║  ██║╚██╗ ██╔╝██╔══██╗██╔════╝██╔══██╗██╔════╝██╔═══██╗████╗  ██║╚══██╔══╝██╔════╝╚██╗██╔╝╚══██╔══╝
   ███████║ ╚████╔╝ ██████╔╝█████╗  ██████╔╝██║     ██║   ██║██╔██╗ ██║   ██║   █████╗   ╚███╔╝    ██║   
   ██╔══██║  ╚██╔╝  ██╔═══╝ ██╔══╝  ██╔══██╗██║     ██║   ██║██║╚██╗██║   ██║   ██╔══╝   ██╔██╗    ██║   
   ██║  ██║   ██║   ██║     ███████╗██║  ██║╚██████╗╚██████╔╝██║ ╚████║   ██║   ███████╗██╔╝ ██╗   ██║   
   ╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝  ╚═╝   ╚═╝   \x1b[0m
 \x1b[90m// 2M-TOKEN GEMINI MONOREPO INTELLIGENCE & CONTEXT CACHING GATEWAY\x1b[0m
`);
}

async function runDemo() {
  printBanner();
  console.log('\x1b[1m\x1b[36m[PACK]\x1b[0m Ingesting sample microservice monorepo (8 source modules)...');
  const packer = new RepoPacker();
  const packed = packer.pack(SAMPLE_MONOREPO_FILES);

  console.log(`  Files:       ${packed.fileCount}`);
  console.log(`  Tokens:      ${TokenEstimator.formatCount(packed.totalTokens)}`);
  console.log(`  Fingerprint: \x1b[90m${packed.fingerprint.substring(0, 32)}...\x1b[0m\n`);

  console.log('\x1b[1m\x1b[34m[CACHE]\x1b[0m Creating persistent Gemini Context Cache on Google Cloud (TTL: 3600s)...');
  const client = new GeminiClient();
  const cache = await client.createCache('demo-monorepo-cache', packed.xml, 3600);
  console.log(`  Cache Name:  \x1b[32m${cache.name}\x1b[0m`);
  console.log(`  Model:       ${cache.model}`);
  console.log(`  Status:      \x1b[32mREADY (75% token discount active)\x1b[0m\n`);

  console.log('\x1b[1m\x1b[35m[QUERY]\x1b[0m Auditing monorepo for authentication and secret verification...');
  const res = await client.queryWithCache(cache.name, 'Where is JWT token verified and what are the security risks?');
  console.log(`  Latency:     \x1b[32m${res.latencyMs} ms\x1b[0m (Time-To-First-Token)`);
  console.log(`  Tokens:      ${TokenEstimator.formatCount(res.tokensUsed)}`);
  console.log(`  Cost:        $${res.cost} USD (vs $${(res.cost * 4).toFixed(4)} uncached)\n`);

  console.log('\x1b[1m\x1b[33m--- GEMINI REASONING SYNTHESIS ---\x1b[0m');
  console.log(res.answer);
  console.log();

  console.log('\x1b[1m\x1b[31m[BLAST RADIUS]\x1b[0m Analyzing transitive ripple effect if "src/db/client.ts" changes:');
  const analyzer = new BlastRadiusAnalyzer(SAMPLE_MONOREPO_FILES);
  const radius = analyzer.analyze('src/db/client.ts');
  console.log(`  Target:             ${radius.target}`);
  console.log(`  Direct Callers:     ${radius.directImpact.join(', ')}`);
  console.log(`  Transitive Ripple:  ${radius.transitiveImpact.join(', ')}`);
  console.log(`  Risk Score:         \x1b[31m${radius.riskScore} / 100\x1b[0m`);
  console.log(`  Exposed Routes:     ${radius.affectedRoutes.join(', ')}\n`);
}

async function handlePack(dirArg) {
  const targetDir = dirArg ? path.resolve(process.cwd(), dirArg) : process.cwd();
  console.log(`\n\x1b[36m[HYPERCONTEXT]\x1b[0m Packing repository at: ${targetDir}`);
  const packer = new RepoPacker();
  const packed = packer.pack(targetDir);

  console.log(`\n=== PACK SUMMARY ===`);
  console.log(`  Files Ingested:    ${packed.fileCount}`);
  console.log(`  Estimated Tokens:  ${TokenEstimator.formatCount(packed.totalTokens)}`);
  console.log(`  AST Fingerprint:   ${packed.fingerprint}`);
  console.log(`  Context Capacity:  ${((packed.totalTokens / 2000000) * 100).toFixed(2)}% of Gemini 2M Window`);
  console.log(`====================\n`);
}

function handleBlastRadius(fileArg) {
  if (!fileArg) {
    console.error('\x1b[31mError:\x1b[0m Please provide a file to analyze. Example: node cli.js blast-radius src/auth/jwt.ts');
    process.exit(1);
  }
  const analyzer = new BlastRadiusAnalyzer(SAMPLE_MONOREPO_FILES);
  const result = analyzer.analyze(fileArg);

  console.log(`\n\x1b[31m=== BLAST RADIUS ANALYSIS ===\x1b[0m`);
  console.log(`  Target File:        ${result.target}`);
  console.log(`  Direct Callers:     ${result.directImpact.length > 0 ? result.directImpact.join(', ') : 'None'}`);
  console.log(`  Transitive Callers: ${result.transitiveImpact.length > 0 ? result.transitiveImpact.join(', ') : 'None'}`);
  console.log(`  Total Impacted:     ${result.totalAffected} files`);
  console.log(`  Risk Score:         ${result.riskScore} / 100`);
  console.log(`=============================\n`);
}

// Router
const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'demo') {
  runDemo();
} else if (command === 'pack') {
  handlePack(args[1]);
} else if (command === 'blast-radius') {
  handleBlastRadius(args[1]);
} else if (command === '--help' || command === '-h') {
  printBanner();
  console.log(`Usage:
  node cli.js                     Run full demo (Context Caching, Query, Blast Radius)
  node cli.js pack [dir]          Pack codebase into 2M-token Gemini XML payload
  node cli.js blast-radius <file> Compute transitive ripple effects of file mutations
  node tests/hypercontext.test.js Run 16-point verification test suite
`);
} else {
  console.error(`Unknown command: ${command}. Use "node cli.js --help" for options.`);
  process.exit(1);
}
