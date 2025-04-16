'use server'

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { Slide, ContentItem } from '@/lib/types';
import { z } from 'zod';

// Define the Zod schema for content items
const contentItemSchema = z.object({
    type: z.enum(['paragraph', 'bullet', 'list', 'quote']),
    content: z.string().describe('The content of the slide').optional(),
    bullet: z.array(z.string()).describe('The bullets of the slide').optional(),
    list: z.array(z.string()).describe('The list of the slide').optional(),
    quote: z.string().describe('The quote of the slide').optional(),
});

// Define the Zod schema for slides with more meaningful slide types
const slideSchema = z.object({
    title: z.string(),
    type: z.enum(['title', 'overview', 'detail', 'comparison', 'statistics', 'case-study', 'conclusion']),
    content: z.array(contentItemSchema),
    contentType: z.literal('mixed')
});

export async function generateSlides(topic: string, slideCount: number = 5): Promise<Slide[]> {
    // Ensure slide count is within reasonable limits
    const validatedSlideCount = Math.min(Math.max(2, slideCount), 10);

    try {
        // Create a schema with the exact slide count needed
        const presentationSchema = z.object({
            slides: z.array(slideSchema).length(validatedSlideCount)
        });

        const { object } = await generateObject({
            model: openai('gpt-4o'),
            schema: presentationSchema,
            prompt: `Create a professional, detailed presentation with exactly ${validatedSlideCount} slides about: ${topic}. Make it comprehensive, data-driven, and include specific details, examples, and statistics where appropriate.`,
            system: `You are an expert presentation designer known for creating richly formatted, visually diverse, and content-rich presentations.
            
            Create a comprehensive presentation about "${topic}" with exactly ${validatedSlideCount} slides following these strict requirements:
            
            SLIDE TYPES AND STRUCTURE:
            1. First slide MUST be a 'title' type with a compelling introduction
            2. Second slide MUST be an 'overview' type that outlines the key points
            3. Middle slides must use a mix of these informative types:
               - 'detail': In-depth explanation of a specific aspect
               - 'comparison': Compare/contrast different perspectives or approaches
               - 'statistics': Present specific numbers, data points, and research findings
               - 'case-study': Real-world example or application
            4. Last slide MUST be a 'conclusion' type with actionable takeaways
            
            CONTENT FORMAT REQUIREMENTS:
            Each slide MUST contain a mix of different content item types:
            - 'paragraph': Full sentences forming cohesive paragraphs (2-3 sentences)
            - 'bullet': Individual point starting with a dash (-)
            - 'list': Numbered or sequential items
            - 'quote': Notable quotation or highlighted text
            
            CONTENT QUALITY REQUIREMENTS:
            1. Include SPECIFIC facts, statistics and examples (use real numbers, dates, names)
            2. Every slide (except title) MUST use at least 2 different content item types
            3. 'paragraph' items: Write 2-3 cohesive sentences with proper transitions
            4. 'bullet' items: Be substantive and specific, not generic
            5. 'list' items: Use for sequential steps, rankings, or prioritized items
            6. 'quote' items: Include attribution where appropriate
            7. Use markdown formatting (*italics* for emphasis, **bold** for key points)
            
            EXAMPLES OF GOOD CONTENT ITEMS:
            1. paragraph: "The global AI market reached **$136.6 billion** in 2022, with a projected annual growth rate of 37.3% through 2030. This exponential growth is driven primarily by enterprise adoption and integration into consumer products."
            2. bullet: "- **Healthcare applications** grew by 45% in 2022, with *diagnostic systems* showing 98.7% accuracy in early cancer detection"
            3. list: "1. Research phase (2-3 months): Conduct market analysis and competitor benchmarking"
            4. quote: ""Artificial intelligence is the new electricity of our era." - Andrew Ng, Stanford University"
            
            The response MUST have exactly ${validatedSlideCount} slides with varied content types, specific details, and visually diverse formatting.`,
            temperature: 0.7,
        });

        // Return the slides from the object
        return object.slides as Slide[];
    } catch (error) {
        console.error('Error generating slides:', error);
        // Return a basic error slide if generation fails
        return [{
            title: 'Slide Generation Error',
            type: 'title',
            content: [{ type: 'paragraph', content: 'Sorry, there was an error generating your presentation. Please try again.' }],
            contentType: 'mixed'
        }];
    }
} 