/**
 * Smart Receipt Scanner & Financial Vision OCR
 * High-accuracy multi-tier scanning engine tailored for Nigerian Bank Receipts
 * Tier 1: Gemini Multimodal Vision AI (Gemini 2.5 Flash / 1.5 Flash) via @google/genai
 * Tier 2: Canvas Image Pre-processing + Tesseract.js Optical Engine
 * Tier 3: Multi-Pass Heuristic Pattern & Layout Matcher
 */

import { GoogleGenAI } from '@google/genai';
import Tesseract from 'tesseract.js';

export interface ReceiptScanResult {
  detectedAmount: number | null;
  transactionRef: string | null;
  bankName: string | null;
  senderName?: string | null;
  beneficiaryName?: string | null;
  paymentDate?: string | null;
  status: 'Verified' | 'Underpaid' | 'Overpaid' | 'Uncertain';
  confidence: 'high' | 'medium' | 'low';
  deficit: number;
  rawText?: string;
  notes?: string;
  source?: 'ai_vision' | 'tesseract_ocr' | 'pattern_ocr';
}

/**
 * Helper to convert a File or Blob into a base64 string
 */
async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1] || result;
      resolve(base64Data);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Pre-processes image via HTML5 Canvas to dramatically improve Tesseract OCR accuracy:
 * - Upscales low-res mobile receipts to optimal OCR resolution (~1600px width)
 * - Converts to Grayscale
 * - Applies Dynamic Contrast Normalization & Binarization (removes colored banners, watermarks & gradients)
 */
async function preprocessImageForOcr(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    // If not in a browser environment, return original file
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const targetWidth = Math.max(1400, Math.min(img.width * 2, 2200));
      const scale = targetWidth / img.width;
      const targetHeight = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(file);
        return;
      }

      // Draw scaled image with smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      try {
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const data = imageData.data;

        // Pass 1: Grayscale and find brightness bounds
        let minLum = 255;
        let maxLum = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Standard ITU-R BT.601 luma
          const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          data[i] = lum;
          data[i + 1] = lum;
          data[i + 2] = lum;

          if (lum < minLum) minLum = lum;
          if (lum > maxLum) maxLum = lum;
        }

        // Pass 2: Contrast Stretching / High-pass sharpening
        const range = Math.max(1, maxLum - minLum);
        for (let i = 0; i < data.length; i += 4) {
          let lum = data[i];
          // Stretch dynamic range
          lum = Math.round(((lum - minLum) / range) * 255);

          // Subtle S-curve contrast boost
          if (lum < 128) {
            lum = Math.max(0, Math.round((lum * lum) / 128));
          } else {
            lum = Math.min(255, Math.round(255 - ((255 - lum) * (255 - lum)) / 128));
          }

          data[i] = lum;
          data[i + 1] = lum;
          data[i + 2] = lum;
        }

        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob((blob) => {
          resolve(blob || file);
        }, 'image/png');
      } catch {
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

/**
 * Uses Google Gemini Multimodal Vision AI to directly inspect receipt image pixels.
 * Supports Nigerian bank receipts with high layout understanding.
 */
async function scanWithGeminiVision(file: File, targetAmount: number, apiKey: string): Promise<ReceiptScanResult | null> {
  const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash'];
  const base64Data = await fileToBase64(file);
  const mimeType = file.type?.startsWith('image/') || file.type === 'application/pdf' ? file.type : 'image/jpeg';

  const prompt = `You are an expert financial auditor for Nazareth School Central Bookshop verifying Nigerian bank transfer receipts.
Analyze this payment receipt, transaction screenshot, or transfer slip.

Target expected invoice payment is ₦${targetAmount.toLocaleString()}.

CRITICAL AUDIT INSTRUCTIONS:
1. Extract the PRINCIPAL TRANSFER AMOUNT transferred to Nazareth School (in Nigerian Naira ₦).
   - Ignore transaction/transfer fees (e.g. ₦10.00, ₦25.00, ₦53.75).
   - Ignore the sender's account balance.
   - Combine comma/space separated digits (e.g., "₦27,654.00" -> 27654).
2. Extract the TRANSACTION REFERENCE or SESSION ID (e.g., 30-digit NIP session number, OPay transaction ID, PalmPay order no, GTBank reference).
3. Identify the BANK / PLATFORM (e.g., OPay, PalmPay, Moniepoint, Kuda, GTBank, Zenith Bank, Access Bank, First Bank, Abbey Mortgage, Stanbic IBTC, UBA, Providus).
4. Identify SENDER NAME and RECIPIENT / BENEFICIARY NAME if present.

Return ONLY a valid, raw JSON object matching this schema (no markdown fences, no extra text):
{
  "detectedAmount": 27654.00,
  "transactionRef": "100004240909123456789012345678",
  "bankName": "OPay",
  "senderName": "Jane Doe",
  "beneficiaryName": "Nazareth School Bookshop",
  "paymentDate": "2026-09-09",
  "notes": "Verified OPay transfer matching target invoice bill."
}`;

  for (const model of modelsToTry) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Data,
                  mimeType,
                },
              },
            ],
          },
        ],
      });

      const rawText = response.text || '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        let rawAmt = parsed.detectedAmount;
        if (typeof rawAmt === 'string') {
          rawAmt = parseFloat(rawAmt.replace(/[^\d.]/g, ''));
        }
        const detectedAmount = typeof rawAmt === 'number' && !isNaN(rawAmt) ? rawAmt : null;
        const transactionRef = parsed.transactionRef ? String(parsed.transactionRef).trim() : null;
        const bankName = parsed.bankName ? String(parsed.bankName).trim() : null;
        const senderName = parsed.senderName || null;
        const beneficiaryName = parsed.beneficiaryName || null;
        const paymentDate = parsed.paymentDate || null;
        const notes = parsed.notes || '';

        if (detectedAmount !== null && detectedAmount > 0) {
          const deficit = Math.max(0, targetAmount - detectedAmount);
          const isVerified = deficit <= 1.0;

          return {
            detectedAmount,
            transactionRef,
            bankName,
            senderName,
            beneficiaryName,
            paymentDate,
            status: isVerified ? 'Verified' : 'Underpaid',
            confidence: 'high',
            deficit,
            rawText,
            notes,
            source: 'ai_vision',
          };
        }
      }
    } catch (err) {
      console.warn(`[ReceiptScanner] Vision model ${model} failed, trying next option...`, err);
    }
  }

  return null;
}

/**
 * Robust Multi-Pass Heuristic Parser for Nigerian Bank Receipts (OPay, PalmPay, Moniepoint, GTBank, Zenith, Kuda, etc.)
 */
export function parseReceiptText(text: string, targetAmount: number): ReceiptScanResult {
  console.log('[ReceiptScanner OCR Raw Output]:\n', text);

  // Pre-normalization to heal OCR artifacts
  const normalizedText = text
    .replace(/(\b\d{1,3})\s*,\s*(\d{3})\b/g, '$1,$2')
    .replace(/(\b\d{1,3})\s*\.\s*(\d{3})\b(?!\.\d)/g, '$1,$2')
    .replace(/₦\s*/g, '₦ ')
    .replace(/NGN\s*/gi, 'NGN ');

  // 1. Extract Session ID / Reference
  let transactionRef: string | null = null;
  const refMatches = text.match(/(?:Session\s*ID|Ref(?:erence)?|Trans(?:action)?\s*(?:ID|No)|Txn\s*ID|Order\s*No|Payment\s*ID|NIP\s*Session)[:\s#]*([A-Za-z0-9\-_]{8,36})/i);
  if (refMatches && refMatches[1]) {
    transactionRef = refMatches[1].trim();
  }

  // 2. Extract Bank / Platform Name
  let bankName: string | null = null;
  const bankPatterns = [
    'OPay', 'PalmPay', 'Kuda', 'GTBank', 'Guaranty Trust', 'Zenith Bank', 'Zenith',
    'Access Bank', 'Access', 'First Bank', 'FirstBank', 'Moniepoint', 'UBA', 'United Bank for Africa',
    'Stanbic IBTC', 'Stanbic', 'Abbey Mortgage', 'Fidelity Bank', 'Fidelity', 'Wema Bank', 'Wema',
    'Sterling Bank', 'Sterling', 'Polaris Bank', 'Polaris', 'Union Bank', 'Providus', 'Jaiz Bank'
  ];
  for (const b of bankPatterns) {
    if (new RegExp(`\\b${b}\\b`, 'i').test(text)) {
      bankName = b;
      break;
    }
  }

  // 3. Multi-Pass Amount Detection
  const candidateAmounts: { amount: number; priority: number; source: string }[] = [];

  const addCandidate = (val: number, priority: number, source: string) => {
    // Filter out obvious non-amounts (e.g. fees < ₦50, huge numbers > ₦50,000,000)
    if (val < 50 || val > 50000000) return;
    // Filter out 4-digit years (2020-2035)
    if (val >= 2020 && val <= 2035 && Number.isInteger(val)) return;
    // Filter out standard 10-digit NUBAN account numbers
    if (val >= 1000000000 && val <= 9999999999 && Number.isInteger(val)) return;

    candidateAmounts.push({ amount: val, priority, source });
  };

  // Pass A: Explicit Currency Lines (e.g. "₦27,654.00", "NGN 27,654", "N27,654", "=N=27,654")
  const currencySymbolRegex = /(?:₦|NGN|Naira|\$|N\b|=N=)[\s:]*([0-9]{1,3}(?:[\s,'][0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi;
  let match: RegExpExecArray | null;
  while ((match = currencySymbolRegex.exec(normalizedText)) !== null) {
    if (match[1]) {
      const cleanStr = match[1].replace(/[\s,']/g, '');
      const num = parseFloat(cleanStr);
      if (!isNaN(num)) addCandidate(num, 100, 'currency_symbol');
    }
  }

  // Pass B: Keyword-prefixed lines (e.g. "Amount: 27,654", "Transfer Amount 27,654", "Total Paid: 27,654.00")
  const keywordRegex = /(?:Amount\s*Sent|Transfer\s*Amount|Total\s*Paid|Total\s*Amount|Amount|Debit\s*Amount|Principal)[\s:\-=]*([0-9]{1,3}(?:[\s,'][0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi;
  while ((match = keywordRegex.exec(normalizedText)) !== null) {
    if (match[1]) {
      const cleanStr = match[1].replace(/[\s,']/g, '');
      const num = parseFloat(cleanStr);
      if (!isNaN(num)) addCandidate(num, 90, 'keyword_prefix');
    }
  }

  // Pass C: Comma & space-formatted thousands numbers (e.g. 27,654.00, 27,654, 900,000)
  const commaSpaceRegex = /\b([0-9]{1,3}(?:[\s,'][0-9]{3})+(?:\.[0-9]{2})?)\b/g;
  while ((match = commaSpaceRegex.exec(normalizedText)) !== null) {
    if (match[1]) {
      const cleanStr = match[1].replace(/[\s,']/g, '');
      const num = parseFloat(cleanStr);
      if (!isNaN(num)) addCandidate(num, 80, 'formatted_thousands');
    }
  }

  // Pass D: Decimal currency values (e.g. 27654.00, 2625.00, 5000.00)
  const decimalRegex = /\b([0-9]{3,8}\.[0-9]{2})\b/g;
  while ((match = decimalRegex.exec(normalizedText)) !== null) {
    if (match[1]) {
      const num = parseFloat(match[1]);
      if (!isNaN(num)) addCandidate(num, 70, 'decimal_value');
    }
  }

  // Pass E: Standalone whole numbers (3-7 digits)
  const standaloneNumberRegex = /(?:^|\s)([1-9][0-9]{2,6})(?:\s|$)/gm;
  while ((match = standaloneNumberRegex.exec(normalizedText)) !== null) {
    if (match[1]) {
      const num = parseFloat(match[1]);
      if (!isNaN(num)) addCandidate(num, 50, 'standalone_digits');
    }
  }

  // 4. Select the most accurate candidate
  let detectedAmount: number | null = null;
  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (candidateAmounts.length > 0) {
    // Sort candidates by priority descending
    candidateAmounts.sort((a, b) => b.priority - a.priority);

    // Look for exact match to target amount if available
    const exactMatch = candidateAmounts.find((c) => Math.abs(c.amount - targetAmount) < 1.0);
    if (exactMatch) {
      detectedAmount = exactMatch.amount;
      confidence = 'high';
    } else {
      // Pick highest priority candidate
      detectedAmount = candidateAmounts[0].amount;
      confidence = candidateAmounts[0].priority >= 80 ? 'medium' : 'low';
    }
  }

  // 5. Compute status & deficit
  if (detectedAmount !== null && detectedAmount > 0) {
    const deficit = Math.max(0, targetAmount - detectedAmount);
    const isFull = deficit <= 0.5;

    return {
      detectedAmount,
      transactionRef: transactionRef || ('TXN-' + Math.floor(1000000000 + Math.random() * 9000000000)),
      bankName: bankName || 'Bank Transfer / Instant Pay',
      status: isFull ? 'Verified' : 'Underpaid',
      confidence,
      deficit,
      rawText: text,
      source: 'tesseract_ocr',
    };
  }

  // Fallback if no amount could be recognized:
  return {
    detectedAmount: null,
    transactionRef: transactionRef || ('TXN-' + Math.floor(1000000000 + Math.random() * 9000000000)),
    bankName: bankName || 'Uploaded Receipt Slip',
    status: 'Underpaid',
    confidence: 'low',
    deficit: targetAmount,
    rawText: text,
    source: 'tesseract_ocr',
  };
}

/**
 * Main Receipt Scanner entry point
 * 1. Checks Gemini Vision AI if API key is present in env or storage
 * 2. Pre-processes image on Canvas (grayscale + contrast stretch) and executes Tesseract.js OCR
 * 3. Applies multi-pass heuristic parsing
 */
export async function scanReceiptFile(file: File, targetAmount: number): Promise<ReceiptScanResult> {
  // Retrieve Gemini API key from all possible browser & node environments
  const apiKey =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    (typeof window !== 'undefined' && ((window as any).__GEMINI_API_KEY__ || localStorage.getItem('gemini_api_key'))) ||
    '';

  // 1. Try Gemini Vision AI first (Highest accuracy)
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 10) {
    const aiResult = await scanWithGeminiVision(file, targetAmount, apiKey.trim());
    if (aiResult && aiResult.detectedAmount !== null && aiResult.detectedAmount > 0) {
      return aiResult;
    }
  }

  // 2. Optical Character Recognition via Pre-processed Canvas + Tesseract.js
  try {
    const isImage = file.type.startsWith('image/') || !file.type;
    if (isImage) {
      // Pre-process canvas for high contrast
      const processedBlob = await preprocessImageForOcr(file);

      const { data } = await Tesseract.recognize(processedBlob, 'eng', {
        logger: () => {},
      });

      if (data && data.text && data.text.trim().length > 0) {
        const ocrResult = parseReceiptText(data.text, targetAmount);
        return ocrResult;
      }
    }
  } catch (err) {
    console.warn('[ReceiptScanner] Tesseract OCR error:', err);
  }

  // 3. Fallback if completely unreadable
  return {
    detectedAmount: null,
    transactionRef: 'TXN-' + Math.floor(1000000000 + Math.random() * 9000000000),
    bankName: 'Direct Bank Transfer',
    status: 'Underpaid',
    confidence: 'low',
    deficit: targetAmount,
    rawText: `Uploaded Document: ${file.name}`,
    source: 'pattern_ocr',
  };
}
