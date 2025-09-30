export interface ExtractedData {
  description: string | null;
  provider: string | null;
  amount: number | null;
  currency: string | null;
  date: string | null; // ISO date format YYYY-MM-DD
  confidence: {
    amount: number;
    date: number;
    provider: number;
    description: number;
  };
}

export interface ExtractionResult {
  data: ExtractedData;
  shouldUseLLM: boolean;
  overallConfidence: number;
}

// Currency symbols and codes
const CURRENCY_SYMBOLS = ['$', '€', '£', '¥', '₹', 'Bs', 'USD', 'EUR', 'GBP', 'JPY', 'INR', 'BOB'];

// Month names in Spanish and English
const MONTH_NAMES = {
  en: ['january', 'february', 'march', 'april', 'may', 'june', 
       'july', 'august', 'september', 'october', 'november', 'december'],
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
       'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
};

// Amount regex patterns - much more comprehensive
const AMOUNT_PATTERNS = [
  // Pattern 1: Currency symbol + amount (highest confidence)
  {
    pattern: /([$€£¥₹Bs])\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)/gi,
    confidence: 0.98,
    description: "Currency symbol + amount"
  },
  // Pattern 2: Total/Suma patterns (very high confidence)
  {
    pattern: /(?:total|suma|subtotal|monto|importe|precio|valor|total\s*:|suma\s*:)\s*([$€£¥₹Bs]?)\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)/gi,
    confidence: 0.95,
    description: "Total/Suma pattern"
  },
  // Pattern 3: Amount + currency symbol (high confidence)
  {
    pattern: /([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)\s*([$€£¥₹Bs])/gi,
    confidence: 0.9,
    description: "Amount + currency"
  },
  // Pattern 4: Decimal amounts with currency (high confidence)
  {
    pattern: /([0-9]+[.,][0-9]{2})\s*([$€£¥₹Bs]?)/gi,
    confidence: 0.85,
    description: "Decimal amount"
  },
  // Pattern 5: Large numbers that look like totals (medium-high confidence)
  {
    pattern: /\b([0-9]{2,4}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)\b/g,
    confidence: 0.7,
    description: "Large number"
  },
  // Pattern 6: Any number with decimal places (medium confidence)
  {
    pattern: /\b([0-9]+[.,][0-9]{2})\b/g,
    confidence: 0.6,
    description: "Decimal number"
  },
  // Pattern 7: Simple amounts (fallback)
  {
    pattern: /\b([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)\b/g,
    confidence: 0.4,
    description: "Simple amount"
  }
];

// Date regex patterns
const DATE_PATTERNS = [
  // DD/MM/YYYY, MM/DD/YYYY
  /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g,
  // YYYY-MM-DD
  /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g,
  // DD Month YYYY, Month DD YYYY
  /\b(\d{1,2})\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/gi,
];

export function extractAmount(text: string): { amount: number | null; currency: string | null; confidence: number } {
  const candidates: Array<{ amount: number; currency: string; confidence: number; position: number; pattern: string }> = [];

  // Process each pattern with its specific confidence level
  AMOUNT_PATTERNS.forEach((patternConfig) => {
    const matches = Array.from(text.matchAll(patternConfig.pattern));
    
    matches.forEach((match) => {
      let amountStr = '';
      let currency = '';
      
      // Extract amount and currency based on pattern structure
      if (patternConfig.pattern.source.includes('\\$€£¥₹Bs.*\\d')) {
        // Currency symbol first pattern
        currency = match[1] || '';
        amountStr = match[2] || '';
      } else if (patternConfig.pattern.source.includes('\\d.*\\$€£¥₹Bs')) {
        // Amount first pattern
        amountStr = match[1] || '';
        currency = match[2] || '';
      } else {
        // Other patterns
        amountStr = match[1] || match[2] || '';
        currency = match[1] || match[2] || '';
        
        // Check if currency is actually in the amount string
        if (CURRENCY_SYMBOLS.some(symbol => amountStr.includes(symbol))) {
          const currencyMatch = amountStr.match(new RegExp(`([${CURRENCY_SYMBOLS.join('')}]+)`, 'i'));
          if (currencyMatch) {
            currency = currencyMatch[1];
            amountStr = amountStr.replace(currency, '').trim();
          }
        }
      }

      // Clean up amount string
      amountStr = amountStr.trim();
      currency = currency.trim();

      const normalizedAmount = normalizeAmount(amountStr);
      
      if (normalizedAmount && normalizedAmount > 0) {
        let confidence = patternConfig.confidence;
        
        // Boost confidence for currency symbols
        if (currency) confidence = Math.min(confidence + 0.05, 1.0);
        
        // Boost confidence for amounts that look like totals (larger numbers)
        if (normalizedAmount > 50) confidence += 0.02;
        if (normalizedAmount > 100) confidence += 0.03;
        if (normalizedAmount > 1000) confidence += 0.02;
        
        // Reduce confidence for very small amounts (likely not totals)
        if (normalizedAmount < 1) confidence -= 0.2;
        if (normalizedAmount < 0.1) confidence -= 0.3;
        
        // Boost confidence if it's in a "total" context
        const contextBefore = text.substring(Math.max(0, (match.index || 0) - 20), match.index || 0).toLowerCase();
        const contextAfter = text.substring(match.index || 0, (match.index || 0) + 20).toLowerCase();
        
        if (contextBefore.includes('total') || contextBefore.includes('suma') || 
            contextAfter.includes('total') || contextAfter.includes('suma')) {
          confidence += 0.1;
        }
        
        candidates.push({
          amount: normalizedAmount,
          currency: currency || 'USD',
          confidence: Math.min(confidence, 1.0),
          position: match.index || 0,
          pattern: patternConfig.description
        });
      }
    });
  });

  if (candidates.length === 0) {
    return { amount: null, currency: null, confidence: 0 };
  }

  // Sort by confidence, then by amount (prefer larger amounts for totals)
  candidates.sort((a, b) => {
    if (Math.abs(a.confidence - b.confidence) < 0.05) {
      return b.amount - a.amount; // Prefer larger amounts when confidence is similar
    }
    return b.confidence - a.confidence;
  });

  const bestMatch = candidates[0];
  console.log(`Amount extraction: Found ${candidates.length} candidates, best: ${bestMatch.amount} ${bestMatch.currency} (${bestMatch.confidence.toFixed(2)}) via ${bestMatch.pattern}`);
  
  return {
    amount: bestMatch.amount,
    currency: bestMatch.currency,
    confidence: bestMatch.confidence
  };
}

export function extractDate(text: string): { date: string | null; confidence: number } {
  for (const pattern of DATE_PATTERNS) {
    const matches = Array.from(text.matchAll(pattern));
    
    for (const match of matches) {
      try {
        let day: number, month: number, year: number;
        
        if (pattern.source.includes('\\d{4}')) {
          // YYYY-MM-DD format
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
        } else if (pattern.source.includes('enero|febrero')) {
          // DD Month YYYY or Month DD YYYY
          const monthName = match[2].toLowerCase();
          const monthIndex = findMonthIndex(monthName);
          
          if (monthIndex !== -1) {
            if (pattern.source.startsWith('\\b(\\d{1,2})')) {
              // DD Month YYYY
              day = parseInt(match[1]);
              month = monthIndex + 1;
              year = parseInt(match[3]);
            } else {
              // Month DD YYYY
              month = monthIndex + 1;
              day = parseInt(match[2]);
              year = parseInt(match[3]);
            }
          } else {
            continue;
          }
        } else {
          // DD/MM/YYYY or MM/DD/YYYY
          const first = parseInt(match[1]);
          const second = parseInt(match[2]);
          const third = parseInt(match[3]);
          
          // Heuristic: if first number > 12, it's probably DD/MM/YYYY
          if (first > 12) {
            day = first;
            month = second;
            year = third;
          } else {
            // Assume MM/DD/YYYY (US format)
            month = first;
            day = second;
            year = third;
          }
        }

        // Validate date
        if (isValidDate(year, month, day)) {
          const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          return { date: isoDate, confidence: 0.9 };
        }
      } catch {
        continue;
      }
    }
  }

  return { date: null, confidence: 0 };
}

export function extractProvider(text: string): { provider: string | null; confidence: number } {
  // Look for common provider patterns with better confidence scoring
  const providerPatterns = [
    // Strong patterns with business indicators
    {
      pattern: /\b([A-Z][a-zA-Z\s&]+(?:Store|Shop|Tienda|Empresa|Company|Corp|Inc|Ltd|S\.A\.|S\.L\.|Restaurant|Café|Supermercado|Farmacia))\b/g,
      confidence: 0.9
    },
    // Razón Social patterns
    {
      pattern: /(?:razón\s*social|business\s*name|company|proveedor|vendor)\s*:?\s*([A-Z][a-zA-Z\s&]{3,40})/gi,
      confidence: 0.85
    },
    // Receipt/ticket patterns
    {
      pattern: /\b([A-Z][a-zA-Z\s&]{3,30})\s*(?:receipt|factura|ticket|recibo|comprobante)/gi,
      confidence: 0.8
    },
    // Common business name patterns (capitalized words)
    {
      pattern: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})\b/g,
      confidence: 0.6
    },
    // Address-like patterns that might be business names
    {
      pattern: /\b([A-Z][a-zA-Z\s&]{4,25})\s*(?:Av\.|Calle|Street|Avenue|Road)/gi,
      confidence: 0.7
    }
  ];

  let bestMatch: { provider: string; confidence: number } | null = null;

  for (const { pattern, confidence } of providerPatterns) {
    const matches = Array.from(text.matchAll(pattern));
    
    for (const match of matches) {
      let provider = match[1].trim();
      
      // Clean up the provider name
      provider = provider.replace(/\s+/g, ' ').trim();
      
      // Skip if too short or too long
      if (provider.length < 3 || provider.length > 50) continue;
      
      // Skip common words that aren't business names
      const skipWords = ['TOTAL', 'SUBTOTAL', 'IVA', 'DESCUENTO', 'PAGO', 'FECHA', 'HORA', 'CANTIDAD', 'PRECIO', 'ITEM'];
      if (skipWords.some(word => provider.toUpperCase().includes(word))) continue;
      
      // Skip if it's mostly numbers
      if (/\d/.test(provider) && provider.length < 8) continue;
      
      if (confidence > (bestMatch?.confidence || 0)) {
        bestMatch = { provider, confidence };
      }
    }
  }

  return bestMatch || { provider: null, confidence: 0 };
}

export function extractDescription(text: string, provider?: string | null): { description: string | null; confidence: number } {
  // Look for description patterns
  const descriptionPatterns = [
    // Strong patterns with labels
    {
      pattern: /(?:concepto|description|descripción|item|artículo|producto|servicio)\s*:?\s*([A-Za-z0-9\s\-,.()]{5,60})/gi,
      confidence: 0.9
    },
    // Product/service lines (usually contain quantities and prices)
    {
      pattern: /\b(\d+)\s+([A-Za-z][A-Za-z0-9\s\-,.]{5,40})\s+[\d.,]+\s*[$€£¥₹Bs]?/gi,
      confidence: 0.8
    },
    // General description patterns
    {
      pattern: /\b([A-Za-z][A-Za-z0-9\s\-,.]{8,50})\b/g,
      confidence: 0.6
    }
  ];

  let bestDescription: string | null = null;
  let bestConfidence = 0;

  for (const { pattern, confidence } of descriptionPatterns) {
    const matches = Array.from(text.matchAll(pattern));
    
    for (const match of matches) {
      let description = match[1]?.trim() || match[2]?.trim() || '';
      
      if (description.length < 5 || description.length > 100) continue;
      
      // Clean up description
      description = description.replace(/\s+/g, ' ').trim();
      
      // Skip if it's likely a provider name (capitalized words)
      if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(description) && !description.toLowerCase().includes('compra')) continue;
      
      // Skip if it's mostly numbers or common receipt words
      const skipWords = ['TOTAL', 'SUBTOTAL', 'IVA', 'DESCUENTO', 'PAGO', 'FECHA', 'HORA', 'CANTIDAD', 'PRECIO'];
      if (skipWords.some(word => description.toUpperCase().includes(word))) continue;
      
      // Skip if it matches the provider
      if (provider && description.toLowerCase().includes(provider.toLowerCase())) continue;
      
      // Boost confidence for descriptions that look like purchases
      let adjustedConfidence = confidence;
      if (description.toLowerCase().includes('compra') || 
          description.toLowerCase().includes('purchase') ||
          description.toLowerCase().includes('producto') ||
          description.toLowerCase().includes('servicio')) {
        adjustedConfidence += 0.1;
      }
      
      if (adjustedConfidence > bestConfidence) {
        bestDescription = description;
        bestConfidence = adjustedConfidence;
      }
    }
  }

  // If no good description found, create a generic one
  if (!bestDescription && provider) {
    bestDescription = `Compra en ${provider}`;
    bestConfidence = 0.5;
  } else if (!bestDescription) {
    bestDescription = 'Gasto registrado';
    bestConfidence = 0.3;
  }

  return { description: bestDescription, confidence: bestConfidence };
}

export function heuristicExtraction(text: string): ExtractionResult {
  const amountResult = extractAmount(text);
  const dateResult = extractDate(text);
  const providerResult = extractProvider(text);
  const descriptionResult = extractDescription(text, providerResult.provider);

  const data: ExtractedData = {
    description: descriptionResult.description,
    provider: providerResult.provider,
    amount: amountResult.amount,
    currency: amountResult.currency,
    date: dateResult.date,
    confidence: {
      amount: amountResult.confidence,
      date: dateResult.confidence,
      provider: providerResult.confidence,
      description: descriptionResult.confidence,
    },
  };

  // Calculate overall confidence with weighted importance
  const weights = {
    amount: 0.4,    // Most important
    date: 0.3,      // Very important
    provider: 0.2,  // Important
    description: 0.1 // Less important (we can generate fallback)
  };
  
  const weightedConfidence = 
    (data.confidence.amount * weights.amount) +
    (data.confidence.date * weights.date) +
    (data.confidence.provider * weights.provider) +
    (data.confidence.description * weights.description);

  // More lenient threshold - only use LLM if really needed
  const shouldUseLLM = 
    weightedConfidence < 0.6 ||  // Lowered threshold
    !data.amount ||              // Must have amount
    (!data.date && !data.provider); // Need either date or provider

  return {
    data,
    shouldUseLLM,
    overallConfidence: weightedConfidence,
  };
}

// Helper functions
function normalizeAmount(amountStr: string): number | null {
  try {
    if (!amountStr || amountStr.trim().length === 0) return null;
    
    // Remove currency symbols and extra whitespace
    let cleaned = amountStr.replace(/[$€£¥₹Bs]/g, '').trim();
    
    // Remove any non-numeric characters except dots and commas
    cleaned = cleaned.replace(/[^\d.,]/g, '');
    
    if (cleaned.length === 0) return null;
    
    // Handle different decimal/thousands separator patterns
    const parts = cleaned.split(/[.,]/);
    
    if (parts.length === 1) {
      // No separators - just a whole number
      const num = parseInt(cleaned, 10);
      return isNaN(num) ? null : num;
    } else if (parts.length === 2) {
      // One separator - need to determine if it's decimal or thousands
      const leftPart = parts[0];
      const rightPart = parts[1];
      
      // If right part is 1-2 digits, likely decimal separator
      if (rightPart.length <= 2) {
        const integerPart = leftPart.replace(/[^\d]/g, '');
        const decimalPart = rightPart;
        const result = parseFloat(`${integerPart}.${decimalPart}`);
        return isNaN(result) ? null : result;
      } else {
        // If right part is 3+ digits, likely thousands separator
        const result = parseFloat(leftPart + rightPart);
        return isNaN(result) ? null : result;
      }
    } else if (parts.length === 3) {
      // Two separators - likely thousands.decimal format
      const thousandsPart = parts[0];
      const hundredsPart = parts[1];
      const decimalPart = parts[2];
      
      if (decimalPart.length <= 2) {
        // Last part is decimal
        const integerPart = thousandsPart + hundredsPart;
        const result = parseFloat(`${integerPart}.${decimalPart}`);
        return isNaN(result) ? null : result;
      } else {
        // All parts are thousands
        const result = parseFloat(thousandsPart + hundredsPart + decimalPart);
        return isNaN(result) ? null : result;
      }
    } else {
      // More than 2 separators - complex case
      // Assume last part is decimal if it's 1-2 digits
      const lastPart = parts[parts.length - 1];
      
      if (lastPart.length <= 2) {
        // Last part is decimal
        const integerParts = parts.slice(0, -1);
        const integerPart = integerParts.join('');
        const result = parseFloat(`${integerPart}.${lastPart}`);
        return isNaN(result) ? null : result;
      } else {
        // No decimal part
        const result = parseFloat(parts.join(''));
        return isNaN(result) ? null : result;
      }
    }
  } catch (error) {
    console.error('Error normalizing amount:', amountStr, error);
    return null;
  }
}

function findMonthIndex(monthName: string): number {
  const lowerMonth = monthName.toLowerCase();
  
  // Check Spanish months
  const spanishIndex = MONTH_NAMES.es.findIndex(month => month.toLowerCase() === lowerMonth);
  if (spanishIndex !== -1) return spanishIndex;
  
  // Check English months
  const englishIndex = MONTH_NAMES.en.findIndex(month => month.toLowerCase() === lowerMonth);
  return englishIndex;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && 
         date.getMonth() === month - 1 && 
         date.getDate() === day;
}
