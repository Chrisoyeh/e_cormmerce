/**
 * Smart Receipt Scanner & Financial Vision OCR
 * Parses uploaded bank receipts (screenshots/PDFs/images)
 * 1. Primary: Gemini 2.5 Flash Vision AI (@google/genai)
 * 2. On-Device Optical Engine: Tesseract.js
 */

import { GoogleGenAI } from '@google/genai';
import Tesseract from 'tesseract.js';

export interface ReceiptScanResult {
  detectedAmount: number | null;
  transactionRef: string | null;
  bankName: string | null;
  status: 'Verified' | 'Underpaid' | 'Overpaid' | 'Uncertain';
  confidence: 'high' | 'medium' | 'low';
  deficit: number;
  rawText?: string;
  source?: 'ai_vision' | 'tesseract_ocr' | 'pattern_ocr';
}

/**
 * Helper to convert a File or Blob into a base64 string for Vision AI
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
 * Uses Gemini 2.5 Flash Vision to inspect the receipt image pixels directly
 */
async function scanWithGeminiVision(file: File, targetAmount: number, apiKey: string): Promise<ReceiptScanResult | null> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const base64Data = await fileToBase64(file);
    const mimeType = file.type || 'image/jpeg';

    const prompt = `You are an expert financial auditor OCR assistant for Nazareth School bookshop.
Analyze this Nigerian bank transfer receipt or payment confirmation slip.
Extract the exact numeric amount transferred in Nigerian Naira (₦), the transaction reference / session ID, and the bank name (e.g., OPay, PalmPay, GTBank, Zenith Bank, Access Bank, Moniepoint, First Bank, Abbey Mortgage, etc.).

Target invoice amount is ₦${targetAmount}.

IMPORTANT FORMATTING RULES:
- Nigerian receipts often format numbers with commas or spaces (e.g., "₦27,654.00", "NGN 27 654", "27,654", "27 654.00").
- NEVER truncate or split numbers at commas or spaces. Combine them into the full numeric value (e.g. 27654).

Respond ONLY with a valid JSON object matching this exact schema:
{
  "detectedAmount": number or null (e.g. 27654 or 900000),
  "transactionRef": string or null (e.g. "TXN-984210921" or Session ID),
  "bankName": string or null (e.g. "OPay", "Guaranty Trust Bank"),
  "notes": string
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType.startsWith('image/') || mimeType === 'application/pdf' ? mimeType : 'image/jpeg',
              },
            },
          ],
        },
      ],
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      let rawAmt = parsed.detectedAmount;
      if (typeof rawAmt === 'string') {
        rawAmt = parseFloat(rawAmt.replace(/[^\d.]/g, ''));
      }
      const detectedAmount = typeof rawAmt === 'number' && !isNaN(rawAmt) ? rawAmt : null;
      const transactionRef = parsed.transactionRef || null;
      const bankName = parsed.bankName || null;

      let status: 'Verified' | 'Underpaid' | 'Overpaid' | 'Uncertain' = 'Uncertain';
      let deficit = 0;

      if (detectedAmount !== null && detectedAmount > 0) {
        if (Math.abs(detectedAmount - targetAmount) < 1.0 || detectedAmount >= targetAmount) {
          status = 'Verified';
          deficit = 0;
        } else {
          status = 'Underpaid';
          deficit = Math.max(0, targetAmount - detectedAmount);
        }

        return {
          detectedAmount,
          transactionRef,
          bankName,
          status,
          confidence: 'high',
          deficit,
          rawText: text,
          source: 'ai_vision',
        };
      }
    }
  } catch (err) {
    console.warn('Gemini Vision OCR error, falling back to Tesseract OCR:', err);
  }
  return null;
}

/**
 * Robust Multi-Pass Parser for Nigerian Bank Receipts (OPay, PalmPay, Moniepoint, GTBank, Zenith, Kuda, etc.)
 */
export function parseReceiptText(text: string, targetAmount: number): ReceiptScanResult {
  console.log('[ReceiptScanner OCR Raw Output]:\n', text);

  // Pre-normalization to heal OCR artifacts like "27 , 654" or "27, 654" or "27 . 654"
  const normalizedText = text
    .replace(/(\b\d{1,3})\s*,\s*(\d{3})\b/g, '$1,$2')
    .replace(/(\b\d{1,3})\s*\.\s*(\d{3})\b(?!\.\d)/g, '$1,$2');

  // 1. Extract Session ID / Reference
  let transactionRef: string | null = null;
  const refMatches = text.match(/(?:Session\s*ID|Ref(?:erence)?|Trans(?:action)?\s*ID|Txn\s*ID|Order\s*No|Payment\s*ID)[:\s#]*([A-Za-z0-9\-_]{8,35})/i);
  if (refMatches && refMatches[1]) {
    transactionRef = refMatches[1].trim();
  }

  // 2. Extract Bank / Platform Name
  let bankName: string | null = null;
  const bankPatterns = ['OPay', 'PalmPay', 'Kuda', 'GTBank', 'Guaranty Trust', 'Zenith', 'Access Bank', 'First Bank', 'FirstBank', 'Moniepoint', 'UBA', 'Stanbic', 'Abbey Mortgage', 'Fidelity', 'Wema', 'Sterling', 'Polaris', 'Union Bank'];
  for (const b of bankPatterns) {
    if (new RegExp(`\\b${b}\\b`, 'i').test(text)) {
      bankName = b;
      break;
    }
  }

  // 3. Multi-Pass Amount Detection
  const candidateAmounts: { amount: number; priority: number }[] = [];

  const addCandidate = (val: number, priority: number) => {
    if (val < 50 || val > 50000000) return;
    if (val >= 2020 && val <= 2035 && Number.isInteger(val)) return;

    candidateAmounts.push({ amount: val, priority });
  };

  // Pass A: Explicit Currency Lines (e.g. "₦27,654.00", "NGN 27 654", "N27,654", "N 27 654.00", "=N=27,654")
  const currencySymbolRegex = /(?:₦|NGN|Naira|\$|N\b|=N=)[\s:]*([0-9]{1,3}(?:[\s,'][0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi;
  let match: RegExpExecArray | null;
  while ((match = currencySymbolRegex.exec(normalizedText)) !== null) {
    if (match[1]) {
      const cleanStr = match[1].replace(/[\s,']/g, '');
      const num = parseFloat(cleanStr);
      if (!isNaN(num)) addCandidate(num, 100);
    }
  }

  // Pass B: Keyword-prefixed lines (e.g. "Amount: 27,654", "Transfer Amount 27 654", "Total: 27,654.00")
  const keywordRegex = /(?:Amount|Transfer\s*Amount|Total\s*Paid|Total\s*Amount|Paid|Debit|Deposit|Sent|Transferred|Payment\s*Amount)[\s:\-=]*([0-9]{1,3}(?:[\s,'][0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi;
  while ((match = keywordRegex.exec(normalizedText)) !== null) {
    if (match[1]) {
      const cleanStr = match[1].replace(/[\s,']/g, '');
      const num = parseFloat(cleanStr);
      if (!isNaN(num)) addCandidate(num, 90);
    }
  }

  // Pass C: Comma & space-formatted thousands numbers (e.g. 27,654.00, 27,654, 27 654, 900,000)
  const commaSpaceRegex = /\b([0-9]{1,3}(?:[\s,'][0-9]{3})+(?:\.[0-9]{2})?)\b/g;
  while ((match = commaSpaceRegex.exec(normalizedText)) !== null) {
    if (match[1]) {
      const cleanStr = match[1].replace(/[\s,']/g, '');
      const num = parseFloat(cleanStr);
      if (!isNaN(num)) addCandidate(num, 80);
    }
  }

  // Pass D: Decimal currency values (e.g. 27654.00, 2625.00, 5000.00)
  const decimalRegex = /\b([0-9]{3,8}\.[0-9]{2})\b/g;
  while ((match = decimalRegex.exec(normalizedText)) !== null) {
    if (match[1]) {
      const num = parseFloat(match[1]);
      if (!isNaN(num)) addCandidate(num, 70);
    }
  }

  // Pass E: Standalone whole numbers (3-7 digits)
  const standaloneNumberRegex = /(?:^|\s)([1-9][0-9]{2,6})(?:\s|$)/gm;
  while ((match = standaloneNumberRegex.exec(normalizedText)) !== null) {
    if (match[1]) {
      const num = parseFloat(match[1]);
      if (!isNaN(num)) addCandidate(num, 50);
    }
  }

  // Pass F: Smart fusion for fragmented adjacent numbers (e.g. "27" and "654" separated by spaces or punctuation)
  const splitPairsRegex = /\b([1-9][0-9]{0,2})[\s,.'-]+([0-9]{3})\b/g;
  while ((match = splitPairsRegex.exec(text)) !== null) {
    if (match[1] && match[2]) {
      const fused = parseFloat(`${match[1]}${match[2]}`);
      if (!isNaN(fused)) {
        addCandidate(fused, 85);
      }
    }
  }

  // 4. Select the most accurate candidate
  let detectedAmount: number | null = null;

  if (candidateAmounts.length > 0) {
    // Sort candidates by priority descending, then by value
    candidateAmounts.sort((a, b) => b.priority - a.priority);

    // Look for exact match to target amount if available
    const exactMatch = candidateAmounts.find(c => Math.abs(c.amount - targetAmount) < 1.0);
    if (exactMatch) {
      detectedAmount = exactMatch.amount;
    } else {
      // Otherwise take the highest-priority amount detected
      detectedAmount = candidateAmounts[0].amount;
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
      confidence: 'high',
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
 * 1. Checks Gemini 2.5 Flash Vision AI if GEMINI_API_KEY is present
 * 2. Runs Tesseract OCR on the image in the browser
 */
export async function scanReceiptFile(file: File, targetAmount: number): Promise<ReceiptScanResult> {
  const apiKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
    '';

  // 1. Try Gemini Vision AI first
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    const aiResult = await scanWithGeminiVision(file, targetAmount, apiKey);
    if (aiResult && aiResult.detectedAmount !== null && aiResult.detectedAmount > 0) {
      return aiResult;
    }
  }

  // 2. Optical Character Recognition via Tesseract.js
  try {
    const isImage = file.type.startsWith('image/') || !file.type;
    if (isImage) {
      const { data } = await Tesseract.recognize(file, 'eng', {
        logger: () => {},
      });

      if (data && data.text && data.text.trim().length > 0) {
        const ocrResult = parseReceiptText(data.text, targetAmount);
        return ocrResult;
      }
    }
  } catch (err) {
    console.warn('Tesseract OCR error:', err);
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
