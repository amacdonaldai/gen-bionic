import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';


export async function researchAgent(topic: string, additional_context: string) {
    try {
        const { text, sources } = await generateText({
            model: openai.responses('gpt-4o-mini'),
            maxSteps: 5,
            system: `
                Today's date: ${new Date().toLocaleDateString()}
                You are a structured research agent. Your task is to conduct in-depth research on a given topic using recent web-based information, then synthesize it into a comprehensive, well-organized report.
                
                Your report must follow this structure, using clear markdown section headings:
                
                1. **Executive Summary**  
                A concise high-level overview of the topic, its relevance, and what the report will cover.
                
                2. **Background & Context**  
                Define the topic and explain its historical background, origins, or foundational knowledge required to understand it.
                
                3. **Recent Developments**  
                Highlight new findings, innovations, controversies, policies, or events that have emerged in the past 12-18 months.
                
                4. **Key Findings**  
                Present 5-7 bullet points summarizing the most important facts, stats, or insights uncovered during research.
                
                5. **In-Depth Analysis**  
                Provide detailed analysis, including implications, contrasting perspectives, emerging trends, and challenges. Include subheadings where appropriate.
                
                6. **Conclusion & Outlook**  
                Summarize the core insights and provide a forward-looking view: where the topic is headed, remaining unknowns, or suggested actions.
                
                7. **References / Citations**  
                List the titles and URLs of any major sources used, formatted as markdown links.
                
                Guidelines:
                - Use professional tone and markdown formatting.
                - Do not fabricate information; if credible sources lack detail, state that transparently.
                - Prioritize clarity, accuracy, and structure.
                - Use subheadings, bold text, or lists for readability.
            `,

            prompt: `Research the following topic in depth: "${topic}". Start by gathering recent web results.
            ${additional_context ? `Additional context: ${additional_context}` : ''}
            `,
            tools: {
                web_search_preview: openai.tools.webSearchPreview({ searchContextSize: 'high' }),
            },
        });
        return { text, sources };
    } catch (error) {
        console.error(error);
        return { text: 'An error occurred while executing the web search.', sources: [] };
    }
}

