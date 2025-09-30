import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { suggestCategory } from '@/app/actions/suggestCategory';
import pdf from 'pdf-parse';
import { extractTextFromImage } from '@/lib/ocr';
import { preprocessImageForOCR } from '@/lib/imagePreprocessing';
import { ExtractedData } from '@/lib/heuristicExtraction';
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': 'ExpenseTracker AI',
  },
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user with Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const fileType = file.type;
    const isPDF = fileType === 'application/pdf';
    const isImage = fileType.startsWith('image/');

    if (!isPDF && !isImage) {
      return NextResponse.json(
        { error: 'File must be a PDF or image' },
        { status: 400 }
      );
    }

    // Extract text from file
    let extractedText = '';
    let ocrConfidence = 0;
    
    if (isPDF) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const data = await pdf(buffer);
      extractedText = data.text;
      ocrConfidence = 0.95; // PDFs have high confidence
    } else if (isImage) {
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Preprocess image for better OCR
      const preprocessedBuffer = await preprocessImageForOCR(buffer);
      
      // Extract text with OCR
      const ocrResult = await extractTextFromImage(preprocessedBuffer);
      extractedText = ocrResult.text;
      ocrConfidence = ocrResult.confidence / 100; // Convert to 0-1 scale
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: 'Could not extract text from file' },
        { status: 400 }
      );
    }

    // Use AI model as primary extraction method
    console.log('Using AI model for invoice scanning');
    const parsedData = await parseTextWithAI(extractedText);

    // Get category suggestion
    const { category } = await suggestCategory(parsedData.description || 'Expense');

    // Calculate overall confidence from AI result
    const overallConfidence = parsedData.confidence ? 
      (parsedData.confidence.amount + parsedData.confidence.date + parsedData.confidence.provider + parsedData.confidence.description) / 4 : 0.8;

    // Save upload record for debugging
    const uploadRecord = await db.upload.create({
      data: {
        userId,
        fileName: file.name,
        ocrText: extractedText,
        parsed: JSON.parse(JSON.stringify(parsedData)),
        confidence: overallConfidence,
      },
    });

    return NextResponse.json({
      success: true,
      uploadId: uploadRecord.id,
      extracted: parsedData,
      category,
      ocrConfidence,
      aiConfidence: overallConfidence,
    });

  } catch (error) {
    console.error('❌ Error processing receipt upload:', error);
    return NextResponse.json(
      { error: 'Failed to process receipt' },
      { status: 500 }
    );
  }
}

function validateAndFixFields(result: ExtractedData): ExtractedData {
  // If everything is in description, try to extract other fields
  if (result.description && result.description.length > 50 && !result.provider && !result.amount) {
    console.log('🔧 Detected all data in description, attempting to fix...');
    
    // Try to extract amount from description
    const amountMatch = result.description.match(/(\d+[.,]?\d*)/g);
    if (amountMatch) {
      const amounts = amountMatch.map(match => parseFloat(match.replace(',', '.')));
      const maxAmount = Math.max(...amounts);
      if (maxAmount > 0) {
        result.amount = maxAmount;
        console.log('🔧 Extracted amount from description:', maxAmount);
      }
    }
    
    // Try to extract provider from description
    const providerMatch = result.description.match(/([A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]+(?:ABC|XYZ|S\.A\.|S\.A|Corp|Inc|Ltd|Restaurant|Tienda|Supermercado|Farmacia))/i);
    if (providerMatch) {
      result.provider = providerMatch[1].trim();
      console.log('🔧 Extracted provider from description:', result.provider);
    }
    
    // Try to extract date from description
    const dateMatch = result.description.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (dateMatch) {
      const dateStr = dateMatch[1];
      const parts = dateStr.split(/[\/\-]/);
      if (parts.length === 3) {
        let day, month, year;
        if (parts[2].length === 4) {
          // DD/MM/YYYY or MM/DD/YYYY
          if (parseInt(parts[0]) > 12) {
            day = parts[0];
            month = parts[1];
            year = parts[2];
          } else {
            month = parts[0];
            day = parts[1];
            year = parts[2];
          }
        } else {
          // DD/MM/YY or MM/DD/YY
          if (parseInt(parts[0]) > 12) {
            day = parts[0];
            month = parts[1];
            year = '20' + parts[2];
          } else {
            month = parts[0];
            day = parts[1];
            year = '20' + parts[2];
          }
        }
        result.date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        console.log('🔧 Extracted date from description:', result.date);
      }
    }
    
    // Clean up description
    if (result.description && result.description.length > 100) {
      result.description = result.description.substring(0, 100) + '...';
    }
  }
  
  // Ensure description is not too long and doesn't contain other fields
  if (result.description) {
    // Remove amounts from description
    result.description = result.description.replace(/\$?\d+[.,]?\d*\s*(USD|EUR|Bs|€|£|¥)?/g, '');
    // Remove dates from description
    result.description = result.description.replace(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g, '');
    // Remove provider names from description
    if (result.provider) {
      result.description = result.description.replace(new RegExp(result.provider, 'gi'), '');
    }
    // Clean up extra spaces
    result.description = result.description.replace(/\s+/g, ' ').trim();
    
    // If description is now empty or too short, provide a default
    if (!result.description || result.description.length < 5) {
      result.description = result.provider ? `Compra en ${result.provider}` : 'Compra general';
    }
  }
  
  return result;
}

async function parseTextWithAI(text: string): Promise<ExtractedData> {
  try {
    const prompt = `Eres un experto en análisis de facturas y recibos. Tu tarea es extraer información específica y separar cada campo correctamente.

⚠️ REGLAS CRÍTICAS - NO VIOLAR:
1. NUNCA pongas el nombre del negocio en "description"
2. NUNCA pongas el monto en "description"  
3. NUNCA pongas la fecha en "description"
4. Cada campo tiene un propósito específico - respétalo

ANÁLISIS POR CAMPO:

🔢 AMOUNT (Monto) - SOLO números:
- Busca: "Total:", "Suma:", "Monto:", "Importe:", "Precio:", "Valor:"
- Ejemplos: "$123.45" → amount: 123.45, "€1.234,56" → amount: 1234.56
- DEBE ser un número, nunca texto
- Si no hay monto claro, amount: null

🏢 PROVIDER (Proveedor) - SOLO nombre del negocio:
- Busca: "Razón Social:", "Empresa:", "Tienda:", "Negocio:"
- Ejemplos: "Supermercado ABC", "Farmacia XYZ", "Restaurant El Buen Sabor"
- Solo el nombre, sin direcciones ni números
- Si no hay nombre claro, provider: null

📝 DESCRIPTION (Descripción) - SOLO qué se compró:
- Describe el tipo de producto/servicio
- Ejemplos: "Compra de alimentos", "Medicamentos", "Servicio de taxi"
- NO incluyas nombre del negocio
- NO incluyas montos ni fechas
- Si no hay descripción clara, description: "Compra general"

📅 DATE (Fecha) - SOLO fecha:
- Busca: "Fecha:", "Date:", "Día:", números con formato de fecha
- Formato: YYYY-MM-DD
- Ejemplos: "12/08/2025" → "2025-08-12", "15 enero 2025" → "2025-01-15"
- Si no hay fecha clara, date: null

💰 CURRENCY (Moneda) - SOLO símbolo:
- Busca: $, €, £, ¥, ₹, Bs, USD, EUR, etc.
- Si no encuentras, currency: "USD"

EJEMPLO CORRECTO:
Si el texto dice: "Supermercado ABC - Total: $150.00 - Fecha: 15/01/2025 - Compra de alimentos"
Respuesta correcta:
{
  "provider": "Supermercado ABC",
  "amount": 150.00,
  "description": "Compra de alimentos", 
  "date": "2025-01-15",
  "currency": "USD"
}

TEXTO OCR A ANALIZAR:
${text}

⚠️ IMPORTANTE: Separa cada campo correctamente. NO pongas todo en description.
Devuelve SOLO el JSON válido:`;

    const completion = await openai.chat.completions.create({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un experto en análisis de facturas y recibos. CRÍTICO: Separa cada campo correctamente. NUNCA pongas todo en "description". Cada campo tiene un propósito específico. Devuelve SOLO JSON válido sin explicaciones.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error('No response from AI');
    }

    console.log('AI Raw Response:', response);

    // Clean the response by removing markdown code blocks if present
    let cleanedResponse = response.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '');
    }

    // Try to find JSON in the response if it's not clean
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0];
    }

    console.log('Cleaned AI Response:', cleanedResponse);

    // Parse AI response
    const parsed = JSON.parse(cleanedResponse);
    
    // Validate and clean the parsed data
    let result = {
      description: parsed.description || null,
      provider: parsed.provider || null,
      amount: parsed.amount ? parseFloat(parsed.amount.toString()) : null,
      currency: parsed.currency || null,
      date: parsed.date || null,
      confidence: parsed.confidence || {
        amount: 0.8,
        date: 0.8,
        provider: 0.8,
        description: 0.8,
      },
    };

    // Post-processing validation to fix common AI mistakes
    result = validateAndFixFields(result);

    console.log('Final Parsed Result:', result);
    return result;

  } catch (error) {
    console.error('❌ Error parsing text with AI:', error);
    // Fallback: try to extract basic info manually
    return {
      description: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      provider: null,
      amount: null,
      currency: null,
      date: null,
      confidence: {
        amount: 0.1,
        date: 0.1,
        provider: 0.1,
        description: 0.1,
      },
    };
  }
}
