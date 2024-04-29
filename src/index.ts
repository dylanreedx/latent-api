import {Hono} from 'hono';
import {Index} from '@upstash/vector';
import Replicate from 'replicate';
import {convertToJSON} from './utils/convert-to-json';
import {getEmbedding} from './utils/get-embedding';
const replicate = new Replicate({
  auth: process.env.REPLICATE_AUTH,
});

const index = new Index({
  url: process.env.UPSTASH_URL,
  token: process.env.UPSTASH_INDEX_TOKEN,
});

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

export default {
  port: 3001,
  fetch: app.fetch,
};
