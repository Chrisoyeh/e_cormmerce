/**
 * WhatsApp Notification Helper
 * Formats Nigerian phone numbers and builds pre-filled WhatsApp dispatch alerts.
 */

import { Order } from '../types';

/**
 * Standardizes a phone number to international format (e.g. 08012345678 -> 2348012345678)
 */
export function formatPhoneNumberForWhatsApp(phone: string | undefined | null): string {
  if (!phone || typeof phone !== 'string') return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '234' + cleaned.substring(1);
  } else if (cleaned.startsWith('+234')) {
    cleaned = cleaned.substring(1);
  } else if (!cleaned.startsWith('234') && cleaned.length === 10) {
    cleaned = '234' + cleaned;
  }
  return cleaned;
}

export interface WhatsAppAlertParams {
  parentPhone?: string;
  parentName?: string;
  pupilName?: string;
  classLevel?: string;
  invoiceNo?: string;
  status?: string;
  totalAmount?: number;
  balanceDue?: number;
  type?: 'ready_pickup' | 'completed' | 'deficit' | 'order_booked';
}

/**
 * Creates a direct WhatsApp Web / App link with a pre-filled professional message for parents.
 * Accepts either an options object or positional parameters.
 */
export function createParentWhatsAppAlertUrl(
  paramsOrPhone: WhatsAppAlertParams | string,
  pupilNameArg?: string,
  classLevelArg?: string,
  orderArg?: Order,
  typeArg?: 'ready_pickup' | 'completed' | 'deficit' | 'order_booked'
): string {
  let phone = '';
  let parentName = 'Parent / Guardian';
  let pupilName = 'Pupil';
  let classLevel = '';
  let invoiceNo = 'INV-';
  let totalAmount = 0;
  let balanceDue = 0;
  let status = '';
  let type: 'ready_pickup' | 'completed' | 'deficit' | 'order_booked' = 'ready_pickup';

  if (typeof paramsOrPhone === 'object' && paramsOrPhone !== null) {
    phone = paramsOrPhone.parentPhone || '';
    parentName = paramsOrPhone.parentName || 'Parent / Guardian';
    pupilName = paramsOrPhone.pupilName || 'Pupil';
    classLevel = paramsOrPhone.classLevel || '';
    invoiceNo = paramsOrPhone.invoiceNo || 'INV-';
    totalAmount = paramsOrPhone.totalAmount || 0;
    balanceDue = paramsOrPhone.balanceDue || 0;
    status = paramsOrPhone.status || '';

    if (paramsOrPhone.type) {
      type = paramsOrPhone.type;
    } else if (status === 'Completed') {
      type = 'completed';
    } else if (status === 'Ready for Pickup') {
      type = 'ready_pickup';
    } else if (balanceDue > 0) {
      type = 'deficit';
    }
  } else {
    phone = typeof paramsOrPhone === 'string' ? paramsOrPhone : '';
    pupilName = pupilNameArg || 'Pupil';
    classLevel = classLevelArg || '';
    if (orderArg) {
      invoiceNo = orderArg.invoiceNo || 'INV-';
      totalAmount = orderArg.totalAmount || 0;
      balanceDue = orderArg.balanceDue || 0;
      status = orderArg.status || '';
    }
    type = typeArg || 'ready_pickup';
  }

  const formattedPhone = formatPhoneNumberForWhatsApp(phone);
  if (!formattedPhone) return '';

  let message = '';

  if (type === 'ready_pickup') {
    message = `🏫 *NAZARETH SCHOOL BOOKSHOP DISPATCH NOTICE*\n\n` +
      `Dear ${parentName} of *${pupilName}*${classLevel ? ` (${classLevel})` : ''},\n\n` +
      `Your school materials requisition *[Invoice: ${invoiceNo}]* has been packed and is now *READY FOR PICKUP* at Desk A (Central Academic Store Office).\n\n` +
      `• Total Amount: ₦${totalAmount.toLocaleString()}\n` +
      `• Payment Status: Verified Complete ✅\n\n` +
      `Please present invoice number *${invoiceNo}* at the counter for textbook release.\n\n` +
      `_Nazareth School, Festac - Academic Store & Registry Office_`;
  } else if (type === 'completed') {
    message = `🏫 *NAZARETH SCHOOL MATERIAL RELEASE CONFIRMATION*\n\n` +
      `Dear ${parentName} of *${pupilName}*${classLevel ? ` (${classLevel})` : ''},\n\n` +
      `This is to confirm that textbooks & study materials for *Invoice ${invoiceNo}* have been successfully *RELEASED & HANDED OUT* to the pupil household.\n\n` +
      `Thank you for supporting your ward's academic success!\n\n` +
      `_Nazareth School, Festac Central Bookshop_`;
  } else if (type === 'deficit') {
    message = `🏫 *NAZARETH SCHOOL BOOKSHOP - PAYMENT SHORTFALL NOTICE*\n\n` +
      `Dear ${parentName} of *${pupilName}*${classLevel ? ` (${classLevel})` : ''},\n\n` +
      `Your bank payment receipt for *Invoice ${invoiceNo}* has been audited. A balance deficit of *₦${balanceDue.toLocaleString()}* is outstanding before books can be released.\n\n` +
      `• Bank: Abbey Mortgage Bank\n` +
      `• Account Name: Nazareth Upper School Bookshop\n` +
      `• Account Number: 3976170710\n\n` +
      `After making the balance transfer, please upload the receipt in your Parent Suite.\n\n` +
      `_Nazareth Central Registrar Office_`;
  } else {
    message = `🏫 *NAZARETH SCHOOL BOOKSHOP INVOICE CREATED*\n\n` +
      `Dear ${parentName} of *${pupilName}*${classLevel ? ` (${classLevel})` : ''},\n\n` +
      `Material requisition *${invoiceNo}* (Total: ₦${totalAmount.toLocaleString()}) has been booked.\n\n` +
      `_Nazareth School Registry_`;
  }

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}
