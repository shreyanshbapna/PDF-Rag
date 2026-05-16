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
function cosineSimilarity(a, b) {
    const dot = a.reduce((sum, val, i) => sum + val * (b[i] ?? 0), 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (magA * magB);
}
async function main() {
    // Step 1: Split the Document into chunks and create embeddings for each chunk
    const paragraph = 'Technology has become an important part of modern life. People can now communicate instantly through smartphones and the internet. Students use technology for online classes and learning resources, while businesses use it to improve productivity and connect with customers. However, excessive use of technology can lead to problems like social media addiction, reduced physical activity, and less face-to-face interaction. Technology is also helpful in healthcare, education, and research. In the future, artificial intelligence may make many tasks easier and faster. Therefore, people should use technology wisely to enjoy its benefits without becoming too dependent on it.';
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 100,
        chunkOverlap: 20,
    });
    const chunks = await splitter.splitText(paragraph);
    const document = await prisma.document.create({
        data: {
            name: 'Sample Document',
            content: paragraph,
        },
    });
    console.log('Document saved with ID:', document.id);
    // Step 2: Embed all chunks
    const chunkEmbeddings = await Promise.all(chunks.map(async (chunk) => {
        const response = await client.embeddings.create({
            model: 'text-embedding-3-small',
            input: chunk,
        });
        return { chunk, emb: response?.data[0]?.embedding };
    }));
    // Step 3: Embed the question
    const question = 'What are the benefits of technology?';
    const questionEmbeddingResponse = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: question,
    });
    const questionEmbedding = questionEmbeddingResponse?.data[0]?.embedding;
    console.log('Embedding for the question:', questionEmbedding);
    console.log('Embedding for the first paragraph chunk:', chunkEmbeddings);
    // Step 4: Rank chunks by similarity
    const ranked = chunkEmbeddings
        .map(({ chunk, emb }) => ({ chunk, score: cosineSimilarity(emb ?? [], questionEmbedding ?? []) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
    console.log('Top matching chunks:');
    ranked.forEach((r, i) => {
        console.log(`\n#${i + 1} (score: ${r.score.toFixed(4)})\n${r.chunk}`);
    });
    // Step 5: Build prompt and call LLM
    const context = ranked.map(r => r.chunk).join('\n\n');
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