"use server";

import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) { throw new Error('Missing OPENAI_API_KEY environment variable') }

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function generateImages(prompts: string[]) {
    const imageResponses = await Promise.all(prompts.map(async (prompt) => {
        const imageResponse = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            style: "natural"
        });
        return imageResponse.data[0]?.url;
    }));
    return imageResponses;
}

