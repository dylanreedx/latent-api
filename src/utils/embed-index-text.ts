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
  const startTime = Date.now();
  console.log(`EmbedAndIndexText started at ${startTime}`);

  const tokenizer = new natural.SentenceTokenizer();
  const chunks = tokenizer.tokenize(text);

  const tokenizeTime = Date.now();
  console.log(`Tokenization took ${tokenizeTime - startTime}ms`);

  let existingDoc = (await index.fetch([pdfId]))?.[0] || {
    id: pdfId,
    metadata: {text: []},
    vector: [],
  };

  const fetchTime = Date.now();
  console.log(`Fetching document took ${fetchTime - tokenizeTime}ms`);

  // Process chunks in parallel
  const embeddedChunks = await Promise.all(
    chunks.map(async (chunk) => {
      const embedding = await model.embedQuery(chunk);
      return {
        text: chunk,
        vector: embedding,
      };
    })
  );

  const processTime = Date.now();
  console.log(`Processing chunks took ${processTime - fetchTime}ms`);

  //@ts-ignore
  existingDoc.metadata.text = embeddedChunks.map((chunk) => chunk.text);

  const avgVector: number[] = embeddedChunks
    .reduce<number[]>((acc, chunk) => {
      acc = acc.map((val, i) => val + chunk.vector[i]);
      return acc;
    }, new Array(embeddedChunks[0].vector.length).fill(0))
    .map((val) => val / embeddedChunks.length);

  existingDoc.vector = avgVector;

  const calcVectorTime = Date.now();
  console.log(
    `Calculating average vector took ${calcVectorTime - processTime}ms`
  );

  try {
    await index.upsert([existingDoc]);
  } catch (error) {
    console.error('Error upserting document:', error);
  } finally {
    const upsertTime = Date.now();
    console.log(`Upserting document took ${upsertTime - calcVectorTime}ms`);
    unlinkSync(`./tmp/${pdfId}.pdf`);
  }

  const endTime = Date.now();
  console.log(
    `EmbedAndIndexText finished at ${endTime}, took ${endTime - startTime}ms`
  );
}
