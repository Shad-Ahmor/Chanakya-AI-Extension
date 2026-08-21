import * as zlib from 'zlib';
import { FactsheetExtractor } from './factsheetExtractor';

/**
 * Pure TypeScript Zero-Dependency PNG Generator & Text-to-Pixel Rasterizer
 * Based on the PxPipe Context-to-Image Token Compression Architecture.
 */

export interface PxPipeRenderOptions {
  fontSize?: number; // default 12
  fontScale?: number; // 1 or 2 (for Retina)
  theme?: 'dark' | 'light';
  title?: string;
  columns?: 1 | 2;
  showLineNumbers?: boolean;
}

export interface PxPipeRenderResult {
  pngBuffer: Buffer;
  base64: string;
  dataUri: string;
  width: number;
  height: number;
  charCount: number;
  estimatedTextTokens: number;
  estimatedImageTokens: number;
  savingsPercentage: number;
  factsheet: string[];
}

export class PxPipeRenderer {
  // Built-in 6x10 Basic ASCII Bitmap Font (32 to 126)
  // Each character is 6 columns wide, 10 rows high represented by 10 row bitmasks
  private static readonly FONT_W = 6;
  private static readonly FONT_H = 10;

  // CRC32 Lookup Table for standard PNG Chunk verification
  private static crcTable: number[] = (() => {
    const table: number[] = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        if (c & 1) {
          c = 0xedb88320 ^ (c >>> 1);
        } else {
          c = c >>> 1;
        }
      }
      table[n] = c;
    }
    return table;
  })();

  private static crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ PxPipeRenderer.crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  /**
   * Extract precision-critical tokens using FactsheetExtractor
   */
  public static extractFactsheet(text: string): string[] {
    return FactsheetExtractor.extract(text).tokens;
  }

  /**
   * Render dense text into a high-density, crisp monospaced PNG Image.
   */
  public static renderTextToPng(text: string, options: PxPipeRenderOptions = {}): PxPipeRenderResult {
    const charCount = text.length;
    const title = options.title || 'CHANAKYA PXPIPE COMPRESSED CONTEXT (OCR OPTIMIZED)';
    const showLineNumbers = options.showLineNumbers !== false;
    const columns = options.columns || 1;

    // Token Economics Math:
    // Text tokens for code/json ~= length / 2.8
    const estimatedTextTokens = Math.ceil(charCount / 2.8);
    // Anthropic / Frontier standard high-res image token cost ~= 1,600 tokens
    const estimatedImageTokens = 1600;
    const savingsPercentage = Math.max(
      0,
      Math.round(((estimatedTextTokens - estimatedImageTokens) / (estimatedTextTokens || 1)) * 100)
    );

    // Setup Dimensions
    const width = 1568; // Standard Claude/Gemini optimal high-res tile width
    const minHeight = 800;
    const lineHeight = 14;
    const charWidth = 7;
    const headerHeight = 44;
    const margin = 16;

    // Wrap and layout text into lines
    const rawLines = text.split('\n');
    const displayLines: { num: number; text: string }[] = [];
    let currentLineNum = 1;

    const maxCharsPerLine = columns === 2 ? 100 : 205;

    for (const rawLine of rawLines) {
      if (rawLine.length === 0) {
        displayLines.push({ num: currentLineNum++, text: '' });
        continue;
      }

      let remaining = rawLine.replace(/\t/g, '  ');
      while (remaining.length > 0) {
        const chunk = remaining.slice(0, maxCharsPerLine);
        displayLines.push({ num: currentLineNum, text: chunk });
        remaining = remaining.slice(maxCharsPerLine);
      }
      currentLineNum++;
    }

    // Calculate dynamic height based on lines
    const totalLinesToRender = columns === 2 ? Math.ceil(displayLines.length / 2) : displayLines.length;
    const calculatedHeight = Math.max(minHeight, headerHeight + totalLinesToRender * lineHeight + margin * 2);
    const height = Math.min(calculatedHeight, 3200); // Max safe vision tile height

    // RGBA Pixel Buffer (Width * Height * 4 bytes)
    const pixelBuffer = Buffer.alloc(width * height * 4);

    // Background color: Dark GitHub / Terminal Slate (#0d1117 = R:13, G:17, B:23)
    const bgR = 13, bgG = 17, bgB = 23;
    const textR = 230, textG = 237, textB = 243; // #e6edf3
    const lineNumR = 100, lineNumG = 115, lineNumB = 130; // #64748b
    const headerBgR = 22, headerBgG = 27, headerBgB = 34; // #161b22
    const headerTextR = 56, headerTextG = 189, headerTextB = 248; // #38bdf8 (Sky Blue)
    const borderR = 48, borderG = 54, borderB = 61; // #30363d

    // Fill background
    for (let i = 0; i < pixelBuffer.length; i += 4) {
      pixelBuffer[i] = bgR;
      pixelBuffer[i + 1] = bgG;
      pixelBuffer[i + 2] = bgB;
      pixelBuffer[i + 3] = 255;
    }

    // Draw Header Background
    for (let y = 0; y < headerHeight; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (y === headerHeight - 1) {
          pixelBuffer[idx] = borderR;
          pixelBuffer[idx + 1] = borderG;
          pixelBuffer[idx + 2] = borderB;
        } else {
          pixelBuffer[idx] = headerBgR;
          pixelBuffer[idx + 1] = headerBgG;
          pixelBuffer[idx + 2] = headerBgB;
        }
      }
    }

    // Helper: Draw a single 6x10 bitmap glyph
    const drawGlyph = (char: string, startX: number, startY: number, r: number, g: number, b: number) => {
      const code = char.charCodeAt(0);
      if (code < 32 || code > 126) return;

      const bitmap = PxPipeRenderer.getGlyphBitmap(code);
      for (let row = 0; row < PxPipeRenderer.FONT_H; row++) {
        const rowBits = bitmap[row];
        const py = startY + row;
        if (py >= height) continue;

        for (let col = 0; col < PxPipeRenderer.FONT_W; col++) {
          if (rowBits & (1 << (PxPipeRenderer.FONT_W - 1 - col))) {
            const px = startX + col;
            if (px >= width) continue;

            const idx = (py * width + px) * 4;
            pixelBuffer[idx] = r;
            pixelBuffer[idx + 1] = g;
            pixelBuffer[idx + 2] = b;
          }
        }
      }
    };

    // Helper: Draw a text string
    const drawString = (str: string, startX: number, startY: number, r: number, g: number, b: number) => {
      let curX = startX;
      for (let i = 0; i < str.length; i++) {
        drawGlyph(str[i], curX, startY, r, g, b);
        curX += charWidth;
      }
    };

    // Draw Header Text & Info Banner
    const headerBanner = `[PXPIPE COMPRESSION] ${title} | Chars: ${charCount.toLocaleString()} | TextTokens: ~${estimatedTextTokens} -> ImgTokens: ~${estimatedImageTokens} (${savingsPercentage}% SAVINGS)`;
    drawString(headerBanner, margin, 16, headerTextR, headerTextG, headerTextB);

    // Draw Lines
    let curY = headerHeight + margin;
    const maxVisibleLines = Math.floor((height - curY - margin) / lineHeight);

    if (columns === 1) {
      for (let i = 0; i < Math.min(displayLines.length, maxVisibleLines); i++) {
        const line = displayLines[i];
        let xOffset = margin;

        if (showLineNumbers) {
          const numStr = String(line.num).padStart(5, ' ') + ' | ';
          drawString(numStr, xOffset, curY, lineNumR, lineNumG, lineNumB);
          xOffset += numStr.length * charWidth;
        }

        drawString(line.text, xOffset, curY, textR, textG, textB);
        curY += lineHeight;
      }
    } else {
      // 2-Column Mode
      const halfLines = Math.ceil(displayLines.length / 2);
      const col2StartX = Math.floor(width / 2) + margin;

      // Draw middle divider
      for (let y = headerHeight; y < height; y++) {
        const midX = Math.floor(width / 2);
        const idx = (y * width + midX) * 4;
        pixelBuffer[idx] = borderR;
        pixelBuffer[idx + 1] = borderG;
        pixelBuffer[idx + 2] = borderB;
      }

      for (let i = 0; i < Math.min(halfLines, maxVisibleLines); i++) {
        // Col 1
        const line1 = displayLines[i];
        let x1 = margin;
        if (showLineNumbers) {
          const numStr1 = String(line1.num).padStart(4, ' ') + ' ';
          drawString(numStr1, x1, curY, lineNumR, lineNumG, lineNumB);
          x1 += numStr1.length * charWidth;
        }
        drawString(line1.text, x1, curY, textR, textG, textB);

        // Col 2
        const line2Index = halfLines + i;
        if (line2Index < displayLines.length) {
          const line2 = displayLines[line2Index];
          let x2 = col2StartX;
          if (showLineNumbers) {
            const numStr2 = String(line2.num).padStart(4, ' ') + ' ';
            drawString(numStr2, x2, curY, lineNumR, lineNumG, lineNumB);
            x2 += numStr2.length * charWidth;
          }
          drawString(line2.text, x2, curY, textR, textG, textB);
        }

        curY += lineHeight;
      }
    }

    // Encode pixel buffer to PNG binary buffer
    const pngBuffer = PxPipeRenderer.encodeRgbaToPng(pixelBuffer, width, height);
    const base64 = pngBuffer.toString('base64');
    const dataUri = `data:image/png;base64,${base64}`;
    const factsheet = PxPipeRenderer.extractFactsheet(text);

    return {
      pngBuffer,
      base64,
      dataUri,
      width,
      height,
      charCount,
      estimatedTextTokens,
      estimatedImageTokens,
      savingsPercentage,
      factsheet
    };
  }

  /**
   * Pure Node.js PNG encoder without native Canvas C++ dependencies.
   */
  private static encodeRgbaToPng(rgbaBuffer: Buffer, width: number, height: number): Buffer {
    // 1. PNG Signature (8 bytes)
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // 2. IHDR Chunk (13 bytes payload)
    const ihdrPayload = Buffer.alloc(13);
    ihdrPayload.writeUInt32BE(width, 0);
    ihdrPayload.writeUInt32BE(height, 4);
    ihdrPayload.writeUInt8(8, 8); // 8 bits per channel
    ihdrPayload.writeUInt8(6, 9); // RGBA (Color type 6)
    ihdrPayload.writeUInt8(0, 10); // Compression method (Deflate)
    ihdrPayload.writeUInt8(0, 11); // Filter method (None)
    ihdrPayload.writeUInt8(0, 12); // Interlace method (None)

    const ihdrChunk = PxPipeRenderer.createPngChunk('IHDR', ihdrPayload);

    // 3. IDAT Chunk (Scanlines filtered with filter type 0 + Deflate compression)
    const scanlineLength = width * 4 + 1; // 1 filter byte per row
    const rawScanlines = Buffer.alloc(scanlineLength * height);

    for (let y = 0; y < height; y++) {
      const scanlineOffset = y * scanlineLength;
      rawScanlines[scanlineOffset] = 0; // Filter type 0 (None)
      const srcOffset = y * width * 4;
      rgbaBuffer.copy(rawScanlines, scanlineOffset + 1, srcOffset, srcOffset + width * 4);
    }

    const compressedIdat = zlib.deflateSync(rawScanlines, { level: 6 });
    const idatChunk = PxPipeRenderer.createPngChunk('IDAT', compressedIdat);

    // 4. IEND Chunk
    const iendChunk = PxPipeRenderer.createPngChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
  }

  private static createPngChunk(type: string, data: Buffer): Buffer {
    const chunk = Buffer.alloc(4 + 4 + data.length + 4);
    chunk.writeUInt32BE(data.length, 0);
    chunk.write(type, 4, 4, 'ascii');
    data.copy(chunk, 8);

    const typeAndData = chunk.slice(4, 8 + data.length);
    const crc = PxPipeRenderer.crc32(typeAndData);
    chunk.writeUInt32BE(crc, 8 + data.length);

    return chunk;
  }

  /**
   * Generates crisp 6x10 bitmask representations for ASCII printable glyphs
   */
  private static getGlyphBitmap(code: number): number[] {
    // Basic algorithmic bitmap matrix for ASCII characters (32 to 126)
    // 0 = space, A-Z, a-z, 0-9, special symbols
    if (code === 32) return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // Space

    if (code >= 48 && code <= 57) {
      // Numbers 0-9
      const numPatterns: Record<number, number[]> = {
        48: [0b011110, 0b100001, 0b100011, 0b100101, 0b101001, 0b110001, 0b100001, 0b011110, 0, 0], // 0
        49: [0b001100, 0b011100, 0b001100, 0b001100, 0b001100, 0b001100, 0b001100, 0b011110, 0, 0], // 1
        50: [0b011110, 0b100001, 0b000001, 0b000010, 0b001100, 0b010000, 0b100000, 0b111111, 0, 0], // 2
        51: [0b011110, 0b100001, 0b000001, 0b001110, 0b000001, 0b000001, 0b100001, 0b011110, 0, 0], // 3
        52: [0b000110, 0b001010, 0b010010, 0b100010, 0b111111, 0b000010, 0b000010, 0b000010, 0, 0], // 4
        53: [0b111111, 0b100000, 0b100000, 0b111110, 0b000001, 0b000001, 0b100001, 0b011110, 0, 0], // 5
        54: [0b011110, 0b100001, 0b100000, 0b111110, 0b100001, 0b100001, 0b100001, 0b011110, 0, 0], // 6
        55: [0b111111, 0b000001, 0b000010, 0b000100, 0b001000, 0b010000, 0b010000, 0b010000, 0, 0], // 7
        56: [0b011110, 0b100001, 0b100001, 0b011110, 0b100001, 0b100001, 0b100001, 0b011110, 0, 0], // 8
        57: [0b011110, 0b100001, 0b100001, 0b011111, 0b000001, 0b000001, 0b100001, 0b011110, 0, 0], // 9
      };
      return numPatterns[code] || [0b111111, 0b100001, 0b100001, 0b111111, 0b100000, 0b100000, 0b100000, 0b100000, 0, 0];
    }

    if (code >= 65 && code <= 90) {
      // Uppercase A-Z key standard templates
      if (code === 65) return [0b011110, 0b100001, 0b100001, 0b111111, 0b100001, 0b100001, 0b100001, 0b100001, 0, 0]; // A
      if (code === 66) return [0b111110, 0b100001, 0b100001, 0b111110, 0b100001, 0b100001, 0b100001, 0b111110, 0, 0]; // B
      if (code === 67) return [0b011110, 0b100001, 0b100000, 0b100000, 0b100000, 0b100000, 0b100001, 0b011110, 0, 0]; // C
      if (code === 68) return [0b111100, 0b100010, 0b100001, 0b100001, 0b100001, 0b100001, 0b100010, 0b111100, 0, 0]; // D
      if (code === 69) return [0b111111, 0b100000, 0b100000, 0b111110, 0b100000, 0b100000, 0b100000, 0b111111, 0, 0]; // E
      if (code === 70) return [0b111111, 0b100000, 0b100000, 0b111110, 0b100000, 0b100000, 0b100000, 0b100000, 0, 0]; // F
      if (code === 71) return [0b011110, 0b100001, 0b100000, 0b100111, 0b100001, 0b100001, 0b100001, 0b011110, 0, 0]; // G
      if (code === 72) return [0b100001, 0b100001, 0b100001, 0b111111, 0b100001, 0b100001, 0b100001, 0b100001, 0, 0]; // H
      if (code === 73) return [0b011110, 0b001100, 0b001100, 0b001100, 0b001100, 0b001100, 0b001100, 0b011110, 0, 0]; // I
      if (code === 74) return [0b000011, 0b000001, 0b000001, 0b000001, 0b000001, 0b100001, 0b100001, 0b011110, 0, 0]; // J
      if (code === 75) return [0b100010, 0b100100, 0b101000, 0b110000, 0b101000, 0b100100, 0b100010, 0b100001, 0, 0]; // K
      if (code === 76) return [0b100000, 0b100000, 0b100000, 0b100000, 0b100000, 0b100000, 0b100000, 0b111111, 0, 0]; // L
      if (code === 77) return [0b100001, 0b110011, 0b101101, 0b100001, 0b100001, 0b100001, 0b100001, 0b100001, 0, 0]; // M
      if (code === 78) return [0b100001, 0b110001, 0b101001, 0b100101, 0b100011, 0b100001, 0b100001, 0b100001, 0, 0]; // N
      if (code === 79) return [0b011110, 0b100001, 0b100001, 0b100001, 0b100001, 0b100001, 0b100001, 0b011110, 0, 0]; // O
      if (code === 80) return [0b111110, 0b100001, 0b100001, 0b111110, 0b100000, 0b100000, 0b100000, 0b100000, 0, 0]; // P
      if (code === 81) return [0b011110, 0b100001, 0b100001, 0b100001, 0b100001, 0b100101, 0b100011, 0b011111, 0, 0]; // Q
      if (code === 82) return [0b111110, 0b100001, 0b100001, 0b111110, 0b101000, 0b100100, 0b100010, 0b100001, 0, 0]; // R
      if (code === 83) return [0b011110, 0b100001, 0b100000, 0b011110, 0b000001, 0b000001, 0b100001, 0b011110, 0, 0]; // S
      if (code === 84) return [0b111111, 0b001100, 0b001100, 0b001100, 0b001100, 0b001100, 0b001100, 0b001100, 0, 0]; // T
      if (code === 85) return [0b100001, 0b100001, 0b100001, 0b100001, 0b100001, 0b100001, 0b100001, 0b011110, 0, 0]; // U
      if (code === 86) return [0b100001, 0b100001, 0b100001, 0b100001, 0b010010, 0b010010, 0b001100, 0b001100, 0, 0]; // V
      if (code === 87) return [0b100001, 0b100001, 0b100001, 0b100001, 0b101101, 0b101101, 0b110011, 0b100001, 0, 0]; // W
      if (code === 88) return [0b100001, 0b100001, 0b010010, 0b001100, 0b010010, 0b100001, 0b100001, 0b100001, 0, 0]; // X
      if (code === 89) return [0b100001, 0b100001, 0b010010, 0b001100, 0b001100, 0b001100, 0b001100, 0b001100, 0, 0]; // Y
      if (code === 90) return [0b111111, 0b000010, 0b000100, 0b001000, 0b010000, 0b100000, 0b100000, 0b111111, 0, 0]; // Z
    }

    if (code >= 97 && code <= 122) {
      // Lowercase a-z
      if (code === 97) return [0, 0, 0b011110, 0b000001, 0b011111, 0b100001, 0b100001, 0b011111, 0, 0]; // a
      if (code === 98) return [0b100000, 0b100000, 0b111110, 0b100001, 0b100001, 0b100001, 0b100001, 0b111110, 0, 0]; // b
      if (code === 99) return [0, 0, 0b011110, 0b100001, 0b100000, 0b100000, 0b100001, 0b011110, 0, 0]; // c
      if (code === 100) return [0b000001, 0b000001, 0b011111, 0b100001, 0b100001, 0b100001, 0b100001, 0b011111, 0, 0]; // d
      if (code === 101) return [0, 0, 0b011110, 0b100001, 0b111111, 0b100000, 0b100001, 0b011110, 0, 0]; // e
      if (code === 102) return [0b001110, 0b010000, 0b111100, 0b010000, 0b010000, 0b010000, 0b010000, 0b010000, 0, 0]; // f
      if (code === 103) return [0, 0, 0b011111, 0b100001, 0b100001, 0b011111, 0b000001, 0b011110, 0b100000, 0]; // g
      if (code === 104) return [0b100000, 0b100000, 0b111110, 0b100001, 0b100001, 0b100001, 0b100001, 0b100001, 0, 0]; // h
      if (code === 105) return [0b001000, 0, 0b011000, 0b001000, 0b001000, 0b001000, 0b001000, 0b011100, 0, 0]; // i
      if (code === 106) return [0b000100, 0, 0b001100, 0b000100, 0b000100, 0b000100, 0b100100, 0b011000, 0, 0]; // j
      if (code === 107) return [0b100000, 0b100000, 0b100100, 0b101000, 0b110000, 0b101000, 0b100100, 0b100010, 0, 0]; // k
      if (code === 108) return [0b011000, 0b001000, 0b001000, 0b001000, 0b001000, 0b001000, 0b001000, 0b011100, 0, 0]; // l
      if (code === 109) return [0, 0, 0b110110, 0b101001, 0b101001, 0b101001, 0b101001, 0b101001, 0, 0]; // m
      if (code === 110) return [0, 0, 0b111110, 0b100001, 0b100001, 0b100001, 0b100001, 0b100001, 0, 0]; // n
      if (code === 111) return [0, 0, 0b011110, 0b100001, 0b100001, 0b100001, 0b100001, 0b011110, 0, 0]; // o
      if (code === 112) return [0, 0, 0b111110, 0b100001, 0b100001, 0b111110, 0b100000, 0b100000, 0b100000, 0]; // p
      if (code === 113) return [0, 0, 0b011111, 0b100001, 0b100001, 0b011111, 0b000001, 0b000001, 0b000001, 0]; // q
      if (code === 114) return [0, 0, 0b101110, 0b110001, 0b100000, 0b100000, 0b100000, 0b100000, 0, 0]; // r
      if (code === 115) return [0, 0, 0b011110, 0b100000, 0b011110, 0b000001, 0b100001, 0b011110, 0, 0]; // s
      if (code === 116) return [0b010000, 0b010000, 0b111100, 0b010000, 0b010000, 0b010000, 0b010001, 0b001110, 0, 0]; // t
      if (code === 117) return [0, 0, 0b100001, 0b100001, 0b100001, 0b100001, 0b100011, 0b011101, 0, 0]; // u
      if (code === 118) return [0, 0, 0b100001, 0b100001, 0b100001, 0b010010, 0b010010, 0b001100, 0, 0]; // v
      if (code === 119) return [0, 0, 0b100001, 0b100001, 0b101101, 0b101101, 0b110011, 0b100001, 0, 0]; // w
      if (code === 120) return [0, 0, 0b100001, 0b010010, 0b001100, 0b010010, 0b100001, 0b100001, 0, 0]; // x
      if (code === 121) return [0, 0, 0b100001, 0b100001, 0b100001, 0b011111, 0b000001, 0b011110, 0, 0]; // y
      if (code === 122) return [0, 0, 0b111111, 0b000010, 0b000100, 0b001000, 0b010000, 0b111111, 0, 0]; // z
    }

    // Punctuation & Symbols
    const punct: Record<number, number[]> = {
      33: [0b001100, 0b001100, 0b001100, 0b001100, 0b001100, 0, 0b001100, 0b001100, 0, 0], // !
      34: [0b010010, 0b010010, 0b010010, 0, 0, 0, 0, 0, 0, 0], // "
      35: [0b010010, 0b111111, 0b010010, 0b010010, 0b111111, 0b010010, 0, 0, 0, 0], // #
      36: [0b001100, 0b011110, 0b101100, 0b011110, 0b001101, 0b011110, 0b001100, 0, 0, 0], // $
      37: [0b110001, 0b110010, 0b000100, 0b001000, 0b010000, 0b010011, 0b100011, 0, 0, 0], // %
      38: [0b011100, 0b100010, 0b011100, 0b010110, 0b100001, 0b100011, 0b011101, 0, 0, 0], // &
      39: [0b001100, 0b001100, 0b000100, 0, 0, 0, 0, 0, 0, 0], // '
      40: [0b000110, 0b001100, 0b011000, 0b011000, 0b011000, 0b001100, 0b000110, 0, 0, 0], // (
      41: [0b011000, 0b001100, 0b000110, 0b000110, 0b000110, 0b001100, 0b011000, 0, 0, 0], // )
      42: [0b000000, 0b010100, 0b001000, 0b111110, 0b001000, 0b010100, 0, 0, 0, 0], // *
      43: [0, 0, 0b001100, 0b001100, 0b111111, 0b001100, 0b001100, 0, 0, 0], // +
      44: [0, 0, 0, 0, 0, 0, 0b001100, 0b001100, 0b000100, 0b001000], // ,
      45: [0, 0, 0, 0b111111, 0, 0, 0, 0, 0, 0], // -
      46: [0, 0, 0, 0, 0, 0, 0b001100, 0b001100, 0, 0], // .
      47: [0b000001, 0b000010, 0b000100, 0b001000, 0b010000, 0b100000, 0, 0, 0, 0], // /
      58: [0, 0b001100, 0b001100, 0, 0, 0b001100, 0b001100, 0, 0, 0], // :
      59: [0, 0b001100, 0b001100, 0, 0, 0b001100, 0b001100, 0b000100, 0b001000, 0], // ;
      60: [0b000010, 0b000100, 0b001000, 0b010000, 0b001000, 0b000100, 0b000010, 0, 0, 0], // <
      61: [0, 0, 0b111111, 0, 0b111111, 0, 0, 0, 0, 0], // =
      62: [0b010000, 0b001000, 0b000100, 0b000010, 0b000100, 0b001000, 0b010000, 0, 0, 0], // >
      63: [0b011110, 0b100001, 0b000010, 0b001100, 0b001100, 0, 0b001100, 0b001100, 0, 0], // ?
      64: [0b011110, 0b100001, 0b101101, 0b101101, 0b101110, 0b100000, 0b011110, 0, 0, 0], // @
      91: [0b011110, 0b010000, 0b010000, 0b010000, 0b010000, 0b010000, 0b011110, 0, 0, 0], // [
      92: [0b100000, 0b010000, 0b001000, 0b000100, 0b000010, 0b000001, 0, 0, 0, 0], // \
      93: [0b011110, 0b000010, 0b000010, 0b000010, 0b000010, 0b000010, 0b011110, 0, 0, 0], // ]
      94: [0b001100, 0b010010, 0b100001, 0, 0, 0, 0, 0, 0, 0], // ^
      95: [0, 0, 0, 0, 0, 0, 0, 0b111111, 0b111111, 0], // _
      96: [0b001100, 0b000110, 0, 0, 0, 0, 0, 0, 0, 0], // `
      123: [0b000110, 0b001100, 0b001100, 0b011000, 0b001100, 0b001100, 0b000110, 0, 0, 0], // {
      124: [0b001100, 0b001100, 0b001100, 0b001100, 0b001100, 0b001100, 0b001100, 0, 0, 0], // |
      125: [0b011000, 0b001100, 0b001100, 0b000110, 0b001100, 0b001100, 0b011000, 0, 0, 0], // }
      126: [0b011001, 0b100110, 0, 0, 0, 0, 0, 0, 0, 0], // ~
    };

    return punct[code] || [0b111111, 0b100001, 0b100001, 0b100001, 0b100001, 0b100001, 0b111111, 0, 0, 0];
  }
}
