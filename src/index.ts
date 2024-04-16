import {Hono} from 'hono';
import {Index} from '@upstash/vector';
import {extractTextFromPDF} from './utils/extract-text-from-pdf';
import * as natural from 'natural';
import {ChatOpenAI, OpenAIEmbeddings} from '@langchain/openai';
import Replicate from 'replicate';
const replicate = new Replicate({
  auth: process.env.REPLICATE_AUTH,
});

const index = new Index({
  url: process.env.UPSTASH_URL,
  token: process.env.UPSTASH_INDEX_TOKEN,
});

function convertToJSON(questionsArray: string[]): object {
  // Join the array elements into a single string
  let questionsString = questionsArray.join('');

  // Find the indices of the first opening and the corresponding closing bracket
  let firstOpeningBracketIndex = questionsString.indexOf('[');
  let firstClosingBracketIndex = questionsString.lastIndexOf(']');

  // Extract the JSON substring from the first opening bracket to the corresponding closing one
  let jsonSubstring = questionsString.substring(
    firstOpeningBracketIndex,
    firstClosingBracketIndex + 1
  );

  // Try to parse the JSON substring. If it fails, return an error.
  try {
    let formattedQuestions = JSON.parse(jsonSubstring);
    return {questions: formattedQuestions};
  } catch (error) {
    console.error('Error parsing questions JSON:', error);
    return {error: 'Failed to parse questions into JSON.'};
  }
}

async function getEmbedding(text: string) {
  const model = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_TOKEN,
    model: 'text-embedding-3-small',
  });

  const embedding = await model.embedQuery(text);
  return embedding;
}

async function tokenize(text: string, pdfId: string) {
  const tokenizer = new natural.SentenceTokenizer();
  const chunks = tokenizer.tokenize(text);
  const model = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_TOKEN,
    model: 'text-embedding-3-small',
  });

  let existingDoc = (await index.fetch([pdfId]))?.[0];
  if (!existingDoc) {
    existingDoc = {id: pdfId, metadata: {text: []}, vector: []};
  }

  for (const chunk of chunks) {
    console.log('Chunk:', chunk);
    const embedding = await model.embedQuery(chunk);
    // @ts-ignore
    existingDoc.metadata.text.push(chunk);
    existingDoc.vector = embedding;

    try {
      await index.upsert([existingDoc]);
    } catch (error) {
      console.error(error);
    }
  }
}

const app = new Hono();

app.get('/', async (c) => {
  const query = c.req.query('q');
  try {
    const filePath = 'mit_lecture_4.pdf';

    const filePaths = [
      'mit_lecture_1.pdf',
      'mit_lecture_2.pdf',
      'mit_lecture_3.pdf',
      'mit_lecture_4.pdf',
    ];

    // const {text, title} = await extractTextFromPDF(filePath, filePath);
    // filePaths.forEach(async (filePath) => {
    //   const {text, title} = await extractTextFromPDF(filePath, filePath);
    //   await tokenize(text, title);
    // });
    // await tokenize(text, title);

    const embedding = await getEmbedding(
      query || 'What is the capital of France?'
    );

    const queryResult = await index.query({
      vector: embedding,
      topK: 5,
      includeMetadata: true,
    });

    const MAX_CONTEXT_LENGTH = 2000; // Adjust this value based on your LLM's prompt size limit
    const textChunks = queryResult
      .flatMap((match) => match.metadata?.text || [])
      .filter((chunk) => {
        const c = chunk as string;
        return c.length <= MAX_CONTEXT_LENGTH;
      }); // Filter out chunks that exceed the maximum length

    let context = textChunks.join('\n\n');

    // If the context is still too large, truncate it
    if (context.length > MAX_CONTEXT_LENGTH) {
      context = context.slice(0, MAX_CONTEXT_LENGTH) + '\n\n...';
    }

    const prompt = `Using the following information:

    Here is context from the student's lecture slides:
    ${context}

    Create 3 multiple-choice questions about ${query}. Each question should have 4 answer options. Format the questions and answers as a JSON array like this:

    [
      {
        "question": "...",
        "options": [
          "...",
          "...",
          "...",
          "..."
        ],
        "answer": "..."
      },
      ...
    ]
`;

    const input = {
      top_p: 1,
      prompt,
      temperature: 0.75,
      system_prompt:
        'You are an expert at helping students learn and study. By using science-based practices you are creating assessments like multiple choice questions to help students learn better. You are creating multiple-choice questions about various/all/any subjects. Each question should have 4 answer options. Format the questions and answers as a JSON array.',
      max_new_tokens: 800,
      repetition_penalty: 1,
    };

    // for await (const event of replicate.stream('meta/llama-2-7b-chat', {
    //   input,
    // })) {
    //   process.stdout.write(`${event}`);
    // }

    const questions = await replicate.run('meta/llama-2-7b-chat', {
      input,
    });

    console.log('Questions:', convertToJSON(questions as string[]));

    return c.json({questions});
  } catch (error) {
    console.error(error);
    return c.json('Failed to extract text from PDF');
  }
});

export default app;
