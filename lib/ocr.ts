// OCR utility for image text extraction
export interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
}

export async function extractTextFromImage(buffer: Buffer): Promise<OCRResult> {
  try {
    // Dynamic import to avoid build issues
    const Tesseract = (await import('tesseract.js')).default;
    
    const { data } = await Tesseract.recognize(buffer, 'spa+eng', {
      logger: () => {}, // Disable logging
    });

    return {
      text: data.text,
      confidence: data.confidence,
      words: (data.blocks || []).flatMap(block => 
        (block.paragraphs || []).flatMap(paragraph =>
          (paragraph.lines || []).flatMap(line =>
            (line.words || []).map(word => ({
              text: word.text,
              confidence: word.confidence,
              bbox: {
                x0: word.bbox.x0,
                y0: word.bbox.y0,
                x1: word.bbox.x1,
                y1: word.bbox.y1,
              },
            }))
          )
        )
      ),
    };
  } catch (error) {
    console.error('OCR processing error:', error);
    throw new Error('Failed to extract text from image');
  }
}
