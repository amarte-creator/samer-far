// Test function for debugging amount extraction
import { extractAmount } from './heuristicExtraction';

export function testAmountExtraction() {
  const testCases = [
    '$123.45',
    '$1,234.56',
    '€1.234,56',
    'Bs 1234,56',
    'Total: $99.99',
    'Suma: €150.00',
    'Monto: Bs 250.50',
    '123.45 USD',
    '1,234.56 €',
    '99.99',
    '150.00',
    '250.50',
    'TOTAL: $1.234,56',
    'SUBTOTAL: €99.99',
    'IMPORTE: Bs 150.00'
  ];

  console.log('=== Amount Extraction Test ===');
  testCases.forEach(testCase => {
    const result = extractAmount(testCase);
    console.log(`Input: "${testCase}" -> Amount: ${result.amount}, Currency: ${result.currency}, Confidence: ${result.confidence.toFixed(2)}`);
  });
  console.log('=== End Test ===');
}

// Call this function to test
// testAmountExtraction();
