import OpenAI from 'openai';
import dotenv from 'dotenv';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
dotenv.config();
const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});
import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
async function main() {
    const paragraph = 'Technology has become an important part of modern life. People can now communicate instantly through smartphones and the internet. Students use technology for online classes and learning resources, while businesses use it to improve productivity and connect with customers. However, excessive use of technology can lead to problems like social media addiction, reduced physical activity, and less face-to-face interaction. Technology is also helpful in healthcare, education, and research. In the future, artificial intelligence may make many tasks easier and faster. Therefore, people should use technology wisely to enjoy its benefits without becoming too dependent on it.';
    const document = await prisma.document.create({
        data: {
            content: paragraph,
        },
    });
    // Step 1: Split the Document into chunks and create embeddings for each chunk
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 100,
        chunkOverlap: 20,
    });
    const chunks = await splitter.splitText(paragraph);
    // Step 2: Embed all chunks
    await Promise.all(chunks.map(async (chunk) => {
        const response = await client.embeddings.create({
            model: 'text-embedding-3-small',
            input: chunk,
        });
        const embedding = JSON.stringify(response?.data[0]?.embedding);
        const id = crypto.randomUUID();
        await prisma.$executeRaw `
        INSERT INTO "Chunk" (id, content, embedding, "documentId")
        VALUES (${id}, ${chunk}, ${embedding}::vector, ${document.id})
      `;
    }));
    // Retrieve all chunk embeddings for the document
    const chunkEmbeddings = await prisma.$queryRaw `
  SELECT content, embedding::text
  FROM "Chunk"
  WHERE "documentId" = ${document.id}
`;
    // Step 3: Embed the question
    const question = 'What are the benefits of technology?';
    const questionEmbeddingResponse = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: question,
    });
    const questionEmbedding = JSON.stringify(questionEmbeddingResponse?.data[0]?.embedding);
    // Step 4: Rank chunks by similarity
    const ranked = await prisma.$queryRaw `
    SELECT content, 1 - (embedding <=> ${questionEmbedding}::vector) AS score
    FROM "Chunk"
    WHERE "documentId" = ${document.id}
    ORDER BY embedding <=> ${questionEmbedding}::vector
    LIMIT 3
  `;
    console.log('Top matching chunks:');
    ranked.forEach((r, i) => {
        console.log(`\n#${i + 1} (score: ${r.score.toFixed(4)})\n${r.content}`);
    });
    // Step 5: Build prompt and call LLM
    const context = ranked.map(r => r.content).join('\n\n');
    console.log('\nContext for LLM:\n', context);
    const apiResponse = await client.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: `Answer the user's question using only the context below.\n\nContext:\n${context}`,
            },
            {
                role: 'user',
                content: question,
            },
        ],
    });
    console.log('\nAnswer:', apiResponse.choices[0]?.message?.content);
}
main();
//# sourceMappingURL=index.js.map