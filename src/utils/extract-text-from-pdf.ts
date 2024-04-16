import {readPdfText} from 'pdf-text-reader';

export async function extractTextFromPDF(pdfFilePath: string, title: string) {
  const pdfText: string = await readPdfText({url: pdfFilePath});

  let cleanedText = pdfText.replace(/6\.0001 LECTURE 1\n\d+/g, '');

  // Remove unnecessary formatting characters
  cleanedText = cleanedText.replace(/[◦›]/g, '');

  // Combine fragmented sentences
  cleanedText = cleanedText.replace(/\n(?!\n)/g, ' ');

  // Remove unnecessary whitespace
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();

  // remove text starts with 'image courtesy'
  cleanedText = cleanedText.replace(/image courtesy.*/g, '');

  // Normalize case
  cleanedText = cleanedText.toLowerCase();

  return {text: cleanedText, title};
}
