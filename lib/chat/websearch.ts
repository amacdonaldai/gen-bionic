"use server"
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

export const executeWebSearch = async (query: string) => {
    try {
        const { text, sources } = await generateText({
            model: openai.responses('gpt-4o-mini'),
            prompt: query,
            tools: {
                web_search_preview: openai.tools.webSearchPreview(),
            },
        });
        return { text, sources };
    } catch (error) {
        console.error(error);
        return { text: 'An error occurred while executing the web search.', sources: [] };
    }
}
