import {OpenAIEmbeddings} from '@langchain/openai';
import {Index} from '@upstash/vector';
import * as natural from 'natural';
import {unlinkSync} from 'node:fs';

const index = new Index({
  url: process.env.UPSTASH_URL,
  token: process.env.UPSTASH_INDEX_TOKEN,
});

const model = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_TOKEN,
  model: 'text-embedding-3-small',
  dimensions: 1536,
});

interface EmbeddedChunk {
  text: string;
  vector: number[];
}

export async function EmbedAndIndexText(text: string, pdfId: string) {
  const tokenizer = new natural.SentenceTokenizer();
  const chunks = tokenizer.tokenize(text);
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

  // Calculate the average vector
  const avgVector: number[] = embeddedChunks
    .reduce((acc: number[], chunk: EmbeddedChunk) => {
      for (let i = 0; i < chunk.vector.length; i++) {
        acc[i] = (acc[i] || 0) + chunk.vector[i];
      }
      return acc;
    }, new Array(embeddedChunks[0].vector.length).fill(0))
    .map((val: number) => val / embeddedChunks.length);

  existingDoc.vector = avgVector;

  try {
    await index.upsert([existingDoc]);
  } catch (error) {
    console.error('Error upserting document:', error);
  } finally {
    unlinkSync(`./tmp/${pdfId}.pdf`);
  }
}
