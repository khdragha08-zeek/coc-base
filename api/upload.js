// api/upload.js
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    
    if (!boundaryMatch) {
      return res.status(400).json({ error: 'No boundary found' });
    }

    let boundary = boundaryMatch[1];
    if (boundary.startsWith('"') && boundary.endsWith('"')) {
      boundary = boundary.slice(1, -1);
    }

    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const start = buffer.indexOf(boundaryBuffer);
    if (start === -1) {
      return res.status(400).json({ error: 'Invalid multipart' });
    }

    let contentStart = buffer.indexOf(Buffer.from('\r\n\r\n'), start);
    if (contentStart === -1) {
      return res.status(400).json({ error: 'No file data' });
    }
    contentStart += 4;

    let end = buffer.indexOf(boundaryBuffer, contentStart);
    if (end === -1) {
      end = buffer.length;
    }

    let fileBuffer = buffer.subarray(contentStart, end);
    while (fileBuffer[fileBuffer.length - 1] === 10 || fileBuffer[fileBuffer.length - 1] === 13) {
      fileBuffer = fileBuffer.subarray(0, fileBuffer.length - 1);
    }

    const headerPart = buffer.subarray(start, contentStart - 4).toString();
    const filenameMatch = headerPart.match(/filename="([^"]+)"/);
    const filename = filenameMatch ? filenameMatch[1] : `image-${Date.now()}.jpg`;

    const { put } = await import('@vercel/blob');
    const blob = await put(filename, fileBuffer, {
      access: 'public',
    });

    return res.status(200).json({ url: blob.url });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message });
  }
}
