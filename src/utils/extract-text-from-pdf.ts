import {readPdfText} from 'pdf-text-reader';

export async function extractTextFromPDF(pdfFilePath: string, title: string) {
  const pdfText: string = await readPdfText({url: pdfFilePath});

  const cleanedText = pdfText
    .replace(/(6\.0001 LECTURE 1\n\d+|image courtesy.*|[◦›])/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return {text: cleanedText, title};
}
