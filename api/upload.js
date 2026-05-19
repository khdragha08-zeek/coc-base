// api/upload.js
import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false, // مهم لاستقبال الملفات
  },
};

export default async function handler(req, res) {
  // فقط نسمح بـ POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'الطريقة غير مسموحة' });
  }

  try {
    // نقرأ الملف من الطلب
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // نحدد نوع المحتوى (content-type) لاستخراج حدود الملف
    const contentType = req.headers['content-type'] || '';
    const boundary = getBoundary(contentType);
    
    if (!boundary) {
      // إذا لم نجد boundary، نتعامل مع الملف مباشرة
      const filename = `upload-${Date.now()}.jpg`;
      const blob = await put(filename, buffer, {
        access: 'public',
      });
      return res.status(200).json({ url: blob.url });
    }

    // استخراج اسم الملف والمحتوى من multipart data
    const { filename, fileBuffer } = parseMultipart(buffer, boundary);
    
    if (!filename || !fileBuffer) {
      return res.status(400).json({ error: 'لم يتم العثور على ملف صالح' });
    }

    // رفع الملف إلى Vercel Blob
    const blob = await put(filename, fileBuffer, {
      access: 'public',
    });

    res.status(200).json({ url: blob.url });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'فشل رفع الملف: ' + error.message });
  }
}

// دالة لاستخراج boundary من content-type
function getBoundary(contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  return match ? (match[1] || match[2]) : null;
}

// دالة لتحليل multipart data
function parseMultipart(buffer, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundaryBuffer = Buffer.from(`--${boundary}--`);
  
  let start = buffer.indexOf(boundaryBuffer);
  if (start === -1) return {};
  
  start += boundaryBuffer.length;
  let end = buffer.indexOf(endBoundaryBuffer);
  if (end === -1) end = buffer.length;
  
  const part = buffer.subarray(start, end);
  
  // استخراج اسم الملف
  const dispositionMatch = part.toString().match(/Content-Disposition: form-data; name="image"; filename="([^"]+)"/);
  const filename = dispositionMatch ? dispositionMatch[1] : `upload-${Date.now()}.jpg`;
  
  // استخراج محتوى الملف (بعد سطرين فارغين)
  const headersEnd = part.indexOf('\r\n\r\n');
  if (headersEnd === -1) return {};
  
  const fileBuffer = part.subarray(headersEnd + 4);
  
  // إزالة الأسطر الإضافية في النهاية
  const trailingNewlines = fileBuffer.indexOf('\r\n');
  const finalBuffer = trailingNewlines > -1 ? fileBuffer.subarray(0, trailingNewlines) : fileBuffer;
  
  return { filename, fileBuffer: finalBuffer };
}