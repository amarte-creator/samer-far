import sharp from 'sharp';

export interface PreprocessingOptions {
  width?: number;
  height?: number;
  grayscale?: boolean;
  normalize?: boolean;
  sharpen?: boolean;
}

export async function preprocessImage(
  buffer: Buffer,
  options: PreprocessingOptions = {}
): Promise<Buffer> {
  const {
    width = 1200,
    height = 1600,
    grayscale = true,
    normalize = true,
    sharpen = true,
  } = options;

  let pipeline = sharp(buffer);

  // Resize image for better OCR
  pipeline = pipeline.resize(width, height, {
    fit: 'inside',
    withoutEnlargement: false,
  });

  // Convert to grayscale for better OCR accuracy
  if (grayscale) {
    pipeline = pipeline.grayscale();
  }

  // Normalize contrast and brightness
  if (normalize) {
    pipeline = pipeline.normalize();
  }

  // Sharpen image for better text clarity
  if (sharpen) {
    pipeline = pipeline.sharpen(1, 1, 2);
  }

  // Apply additional enhancements
  pipeline = pipeline
    .modulate({
      brightness: 1.1,
      saturation: 1.0,
    })
    .linear(1.1, -(128 * 0.1)); // Increase contrast

  return await pipeline.png().toBuffer();
}

export async function preprocessImageForOCR(buffer: Buffer): Promise<Buffer> {
  return preprocessImage(buffer, {
    width: 1200,
    height: 1600,
    grayscale: true,
    normalize: true,
    sharpen: true,
  });
}
