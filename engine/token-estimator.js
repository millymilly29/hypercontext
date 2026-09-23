/**
 * HYPERCONTEXT // Gemini Token Estimator
 * Calibrated token counter modeled on Google Gemini 1.5 / 2.0 BPE tokenizer.
 * Specialized for source code, indentation whitespace, and multi-file XML syntax.
 */

class TokenEstimator {
  /**
   * Estimates token count for text using Gemini BPE characteristics.
   * Matches whitespace blocks, punctuation, and code identifier subwords.
   * 
   * @param {string} text 
   * @returns {number}
   */
  static estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    if (text.length === 0) return 0;

    // Fast regex matching Gemini's BPE vocabulary structure:
    // 1. Indentation blocks (2-4 spaces)
    // 2. Words / identifiers (letters & numbers)
    // 3. Operators & symbols
    const matches = text.match(/[\p{L}\p{N}_]+|[^\s\p{L}\p{N}]+|\s{2,4}|\n/gu);
    if (!matches) return 0;

    let count = 0;
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      if (m.length > 8 && /[\p{L}\p{N}]/u.test(m)) {
        // Multi-syllable or CamelCase long words are split into ~4 char chunks
        count += Math.ceil(m.length / 4);
      } else {
        count++;
      }
    }

    return count;
  }

  /**
   * Formats token count with human-readable suffixes (k, M).
   * @param {number} count 
   * @returns {string}
   */
  static formatCount(count) {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(2) + 'M tokens';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'k tokens';
    }
    return count + ' tokens';
  }

  /**
   * Truncates text to remain strictly within specified token budget.
   * @param {string} text 
   * @param {number} maxTokens 
   * @returns {string}
   */
  static truncate(text, maxTokens) {
    if (TokenEstimator.estimateTokens(text) <= maxTokens) return text;
    let candidate = text.slice(0, Math.floor(maxTokens * 3.0));
    while (TokenEstimator.estimateTokens(candidate) > maxTokens && candidate.length > 0) {
      candidate = candidate.slice(0, Math.floor(candidate.length * 0.8));
    }
    return candidate + '\n... [TRUNCATED]';
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TokenEstimator };
}
