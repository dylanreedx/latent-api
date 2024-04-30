import axios from 'axios';
import {mkdir, readdir} from 'node:fs/promises';
import {EmbedAndIndexText} from './embed-index-text';
import {extractTextFromPDF} from './extract-text-from-pdf';

export async function downloadPdf(url: string, name: string): Promise<string> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
  });

  const fileData = Buffer.from(response.data, 'binary');

  const pdfFilePath = `./tmp/${name}.pdf`;

  try {
    await Bun.write(`./tmp/${name}.pdf`, fileData);
    return pdfFilePath;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return 'Failed to extract text from PDF';
  }
}
