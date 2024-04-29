import {OpenAIEmbeddings} from '@langchain/openai';
import {Index} from '@upstash/vector';
import * as natural from 'natural';
const index = new Index({
  url: process.env.UPSTASH_URL,
  token: process.env.UPSTASH_INDEX_TOKEN,
});
export async function EmbedAndIndexText(text: string, pdfId: string) {
  const tokenizer = new natural.SentenceTokenizer();
  const chunks = tokenizer.tokenize(text);
  const model = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_TOKEN,
    model: 'text-embedding-3-small',
  });

  let existingDoc = (await index.fetch([pdfId]))?.[0] || {
    id: pdfId,
    metadata: {text: []},
    vector: [],
  };

  const embeddedChunks = await Promise.all(
    chunks.map(async (chunk) => {
      const embedding = await model.embedQuery(chunk);
      return {
        text: chunk,
        vector: embedding,
      };
    })
  );

  // @ts-expect-error
  existingDoc.metadata.text = embeddedChunks.map((chunk) => chunk.text);
  existingDoc.vector = embeddedChunks.flatMap((chunk) => chunk.vector);

  try {
    await index.upsert([existingDoc]);
  } catch (error) {
    console.error('Error upserting document:', error);
  }
}
