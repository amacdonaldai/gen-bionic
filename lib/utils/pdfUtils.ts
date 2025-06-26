import { jsPDF } from "jspdf";
import { nanoid } from "nanoid";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Keep interfaces for backward compatibility
export interface MarkdownItemBase {
    type: string;
}

export interface HeadingItem extends MarkdownItemBase {
    type: 'heading';
    level: number;
    text: string;
    formatting?: any;
}

export interface ParagraphItem extends MarkdownItemBase {
    type: 'paragraph';
    text: string;
    formatting?: any;
}

export interface ListItem extends MarkdownItemBase {
    type: 'list-item';
    text: string;
    formatting?: any;
}

export interface NumberedListItem extends MarkdownItemBase {
    type: 'numbered-list-item';
    number: number;
    text: string;
    formatting?: any;
}

export interface CodeItem extends MarkdownItemBase {
    type: 'code';
    text: string;
}

export interface BlockquoteItem extends MarkdownItemBase {
    type: 'blockquote';
    text: string;
    formatting?: any;
}

export interface ImageItem extends MarkdownItemBase {
    type: 'image';
    alt: string;
    url: string;
}

export interface HorizontalRuleItem extends MarkdownItemBase {
    type: 'hr';
}

export interface SpaceItem extends MarkdownItemBase {
    type: 'space';
}

export type MarkdownItem =
    | HeadingItem
    | ParagraphItem
    | ListItem
    | NumberedListItem
    | CodeItem
    | BlockquoteItem
    | ImageItem
    | HorizontalRuleItem
    | SpaceItem;

/**
 * Parse markdown content into structured items for PDF rendering
 * @param markdown The markdown content to parse
 * @returns An array of structured markdown items
 */
export function parseMarkdownForPDF(markdown: string): MarkdownItem[] {
    // Create a virtual DOM element with the parsed markdown
    const markdownComponent = ReactMarkdown({
        children: markdown,
        remarkPlugins: [remarkGfm],
    });

    // Convert the React component to HTML string
    const htmlString = renderToStaticMarkup(markdownComponent as ReactElement);

    // Parse the HTML to extract structured items
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const elements = doc.body.children;

    const result: MarkdownItem[] = [];

    // Helper function to process text nodes and find links
    const processTextFormatting = (element: Element) => {
        // Check for formatting elements
        const boldElements = element.querySelectorAll('strong');
        const linkElements = element.querySelectorAll('a');

        const formatting: any = {};

        // Process bold ranges
        // if (boldElements.length > 0) {
        //     formatting.boldRanges = [];
        //     boldElements.forEach(bold => {
        //         const text = bold.textContent || '';
        //         // Approximate the position in the plain text
        //         const fullText = element.textContent || '';
        //         const index = fullText.indexOf(text);
        //         if (index !== -1) {
        //             formatting.boldRanges.push({
        //                 text,
        //                 index,
        //                 length: text.length
        //             });
        //         }
        //     });
        // }

        // Process link ranges
        if (linkElements.length > 0) {
            formatting.linkRanges = [];
            linkElements.forEach(link => {
                const text = link.textContent || '';
                const url = link.getAttribute('href') || '';
                // Approximate the position in the plain text
                const fullText = element.textContent || '';
                const index = fullText.indexOf(text);
                if (index !== -1) {
                    formatting.linkRanges.push({
                        text,
                        url,
                        index,
                        length: text.length
                    });
                }
            });
        }

        return formatting;
    };

    // Process each element
    for (let i = 0; i < elements.length; i++) {
        const element = elements[i];

        // Extract the element type and content
        switch (element.tagName.toLowerCase()) {
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6':
                const level = parseInt(element.tagName.substring(1), 10);
                const headingFormatting = processTextFormatting(element);
                result.push({
                    type: 'heading',
                    level,
                    text: element.textContent || '',
                    formatting: headingFormatting
                } as HeadingItem);
                break;

            case 'p':
                const paragraphFormatting = processTextFormatting(element);
                result.push({
                    type: 'paragraph',
                    text: element.textContent || '',
                    formatting: paragraphFormatting
                } as ParagraphItem);
                break;

            case 'ul':
                // Process list items
                for (let j = 0; j < element.children.length; j++) {
                    const li = element.children[j];
                    const listItemFormatting = processTextFormatting(li);
                    result.push({
                        type: 'list-item',
                        text: li.textContent || '',
                        formatting: listItemFormatting
                    } as ListItem);
                }
                break;

            case 'ol':
                // Process numbered list items
                for (let j = 0; j < element.children.length; j++) {
                    const li = element.children[j];
                    const numberedItemFormatting = processTextFormatting(li);
                    result.push({
                        type: 'numbered-list-item',
                        number: j + 1,
                        text: li.textContent || '',
                        formatting: numberedItemFormatting
                    } as NumberedListItem);
                }
                break;

            case 'pre':
                // Extract code block
                const code = element.querySelector('code');
                result.push({
                    type: 'code',
                    text: code ? code.textContent || '' : element.textContent || '',
                } as CodeItem);
                break;

            case 'blockquote':
                const blockquoteFormatting = processTextFormatting(element);
                result.push({
                    type: 'blockquote',
                    text: element.textContent || '',
                    formatting: blockquoteFormatting
                } as BlockquoteItem);
                break;

            case 'hr':
                result.push({
                    type: 'hr',
                } as HorizontalRuleItem);
                break;

            case 'img':
                const img = element as HTMLImageElement;
                result.push({
                    type: 'image',
                    alt: img.alt || '',
                    url: img.src || '',
                } as ImageItem);
                break;

            case 'br':
                result.push({
                    type: 'space',
                } as SpaceItem);
                break;

            default:
                // For other elements, treat as paragraphs
                if (element.textContent && element.textContent.trim()) {
                    const defaultFormatting = processTextFormatting(element);
                    result.push({
                        type: 'paragraph',
                        text: element.textContent,
                        formatting: defaultFormatting
                    } as ParagraphItem);
                }
        }
    }

    return result;
}

/**
 * Generate a PDF document from markdown content
 * @param content The markdown content to convert to PDF
 * @param title The title for the PDF document
 * @returns A Promise that resolves when the PDF is generated
 */
export async function generatePDF(content: string, title: string = 'Research Document'): Promise<boolean> {
    try {
        // Create jsPDF instance
        const pdf = new jsPDF();

        // Set up PDF document
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);
        let y = margin;

        // Parse and process the markdown content
        const parsedContent = parseMarkdownForPDF(content);
        console.log(parsedContent)

        // Add content
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');

        // Function to apply text formatting
        const renderFormattedText = (text: string, x: number, y: number, formatting: any = {}, maxWidth: number) => {
            if (!formatting || (!formatting.boldRanges && !formatting.linkRanges)) {
                // Simple text without formatting
                const lines = pdf.splitTextToSize(text, maxWidth);
                pdf.text(lines, x, y);
                return lines.length * 6;
            }

            // Split text to fit width while preserving format positions
            const lines = pdf.splitTextToSize(text, maxWidth);

            // Calculate character positions in the wrapped text
            let charPos = 0;
            const lineRanges: any[] = [];

            lines.forEach((line: string) => {
                const lineRange = {
                    text: line,
                    startPos: charPos,
                    endPos: charPos + line.length,
                    bold: [] as any[],
                    links: [] as any[]
                };

                if (formatting.boldRanges) {
                    formatting.boldRanges.forEach((boldRange: any) => {
                        // Check if bold range is in this line
                        if (boldRange.index + boldRange.length > lineRange.startPos &&
                            boldRange.index < lineRange.endPos) {
                            lineRange.bold.push({
                                start: Math.max(0, boldRange.index - lineRange.startPos),
                                end: Math.min(line.length, boldRange.index + boldRange.length - lineRange.startPos)
                            });
                        }
                    });
                }

                if (formatting.linkRanges) {
                    formatting.linkRanges.forEach((linkRange: any) => {
                        // Check if link is in this line
                        if (linkRange.index + linkRange.length > lineRange.startPos &&
                            linkRange.index < lineRange.endPos) {
                            lineRange.links.push({
                                text: linkRange.text,
                                url: linkRange.url,
                                start: Math.max(0, linkRange.index - lineRange.startPos),
                                end: Math.min(line.length, linkRange.index + linkRange.text.length - lineRange.startPos)
                            });
                        }
                    });
                }

                lineRanges.push(lineRange);
                charPos += line.length + 1; // +1 for the newline
            });

            // Render each line with its formatting
            let currentY = y;
            let heightUsed = 0;

            lineRanges.forEach((lineRange, idx) => {
                const line = lineRange.text;

                // For each line, we first draw the normal text base
                // Then apply formatting on top carefully to avoid overlap

                // First, create a map of which character segments will be styled differently
                const charMap = new Array(line.length).fill(null);

                // Mark bold segments in the map
                if (lineRange.bold.length > 0) {
                    lineRange.bold.forEach((bold: any) => {
                        for (let i = bold.start; i < bold.end; i++) {
                            charMap[i] = { type: 'bold' };
                        }
                    });
                }

                // Mark link segments in the map (links take precedence over bold)
                if (lineRange.links.length > 0) {
                    lineRange.links.forEach((link: any) => {
                        for (let i = link.start; i < link.end; i++) {
                            charMap[i] = {
                                type: 'link',
                                url: link.url
                            };
                        }
                    });
                }

                // Now we'll render segments based on the character map
                // Group adjacent characters with the same formatting
                const segments: Array<{ text: string, type: string | null, url?: string, startIdx: number }> = [];
                let currentSegment: { text: string, type: string | null, url?: string, startIdx: number } | null = null;

                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    const formatting = charMap[i];
                    const formattingType = formatting ? formatting.type : null;

                    if (!currentSegment || currentSegment.type !== formattingType) {
                        if (currentSegment) {
                            segments.push(currentSegment);
                        }
                        currentSegment = {
                            text: char,
                            type: formattingType,
                            startIdx: i
                        };
                        if (formatting && formatting.url) {
                            currentSegment.url = formatting.url;
                        }
                    } else {
                        currentSegment.text += char;
                    }
                }

                if (currentSegment) {
                    segments.push(currentSegment);
                }

                // Render each segment with appropriate formatting
                for (const segment of segments) {
                    // Calculate position based on character width
                    const segmentX = x + pdf.getStringUnitWidth(line.substring(0, segment.startIdx)) *
                        pdf.getFontSize() / pdf.internal.scaleFactor;

                    if (segment.type === 'bold') {
                        pdf.setFont('helvetica', 'bold');
                        pdf.text(segment.text, segmentX, currentY);
                        pdf.setFont('helvetica', 'normal');
                    } else if (segment.type === 'link') {
                        pdf.setTextColor(0, 0, 255); // Blue color for links
                        pdf.text(segment.text, segmentX, currentY);

                        // Underline the link
                        const textWidth = pdf.getStringUnitWidth(segment.text) *
                            pdf.getFontSize() / pdf.internal.scaleFactor;
                        pdf.line(segmentX, currentY + 1, segmentX + textWidth, currentY + 1);

                        // Add link annotation
                        if (segment.url) {
                            pdf.link(segmentX, currentY - 5, textWidth, 6, { url: segment.url });
                        }

                        pdf.setTextColor(0, 0, 0); // Reset to black
                    } else {
                        // Normal text - only render if not covered by other formatting
                        // Check if this segment overlaps with any formatting
                        const hasOverlap = segments.some(otherSegment =>
                            otherSegment !== segment &&
                            otherSegment.type !== null &&
                            otherSegment.startIdx <= segment.startIdx &&
                            otherSegment.startIdx + otherSegment.text.length >= segment.startIdx + segment.text.length
                        );

                        if (!hasOverlap) {
                            pdf.text(segment.text, segmentX, currentY);
                        }
                    }
                }

                currentY += 6;
                heightUsed += 6;
            });

            return heightUsed;
        };

        // Add processed headings to avoid duplication
        const processedHeadings = new Set<string>();

        for (const item of parsedContent) {
            // Check if we need a new page
            if (y > pdf.internal.pageSize.getHeight() - margin - 10) {
                pdf.addPage();
                y = margin;
            }

            // Handle different element types
            switch (item.type) {
                case 'heading':
                    // Calculate font size based on heading level
                    const headingItem = item as any;
                    const fontSize = 18 - ((headingItem.level || 1) * 2);
                    pdf.setFontSize(fontSize);
                    pdf.setFont('helvetica', 'bold');

                    // Store unique heading ID to avoid duplication
                    const headingId = `heading-${headingItem.text}-${headingItem.level}`;

                    // Only render if we haven't seen this exact heading before
                    if (!processedHeadings.has(headingId)) {
                        processedHeadings.add(headingId);

                        // Render heading with any formatting
                        const heightUsed = renderFormattedText(
                            headingItem.text,
                            margin,
                            y,
                            headingItem.formatting,
                            contentWidth
                        );

                        y += heightUsed;
                    }

                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(12);
                    break;

                case 'paragraph':
                    const paragraphItem = item as any;
                    y += renderFormattedText(
                        paragraphItem.text,
                        margin,
                        y,
                        paragraphItem.formatting,
                        contentWidth
                    );
                    break;

                case 'list-item':
                    // Indent list items
                    const listItem = item as any;
                    const listIndent = margin + 5;
                    const bulletWidth = 3;
                    const listContentWidth = contentWidth - 8;

                    // Add bullet point
                    pdf.text('•', listIndent, y);

                    console.log(listItem.text)

                    // Add text with proper indentation and formatting
                    y += renderFormattedText(
                        listItem.text,
                        listIndent + bulletWidth,
                        y - 6,
                        listItem.formatting,
                        listContentWidth
                    );
                    break;

                case 'numbered-list-item':
                    const numberedItem = item as any;
                    const numberedIndent = margin + 5;
                    const numberWidth = 10; // Increased from 8 to 10 for more space
                    const numberedContentWidth = contentWidth - 12; // Increased spacing

                    // Add item number
                    pdf.text(`${numberedItem.number}.`, numberedIndent, y);

                    // Add text with proper indentation and formatting
                    y += renderFormattedText(
                        numberedItem.text,
                        numberedIndent + numberWidth,
                        y,
                        numberedItem.formatting,
                        numberedContentWidth
                    );
                    break;

                case 'code':
                    // Set monospace font and background for code
                    const codeItem = item as CodeItem;
                    pdf.setFont('courier', 'normal');

                    // Split code into lines
                    const codeLines = codeItem.text.split('\n');
                    const codeHeight = (codeLines.length * 6) + 4;

                    // Draw background for code blocks
                    pdf.setFillColor(240, 240, 240);
                    pdf.rect(margin, y - 3, contentWidth, codeHeight, 'F');

                    // Draw border
                    pdf.setDrawColor(200, 200, 200);
                    pdf.rect(margin, y - 3, contentWidth, codeHeight, 'S');

                    let codeY = y + 2;
                    for (const line of codeLines) {
                        const trimmedLine = line.trimEnd();
                        if (trimmedLine) {
                            pdf.text(trimmedLine, margin + 3, codeY);
                        }
                        codeY += 6;
                    }

                    // Reset font
                    pdf.setFont('helvetica', 'normal');
                    y += codeHeight + 3;
                    break;

                case 'blockquote':
                    // Style for blockquotes
                    const blockquoteItem = item as any;

                    // Calculate height of quote
                    const quoteLines = pdf.splitTextToSize(blockquoteItem.text, contentWidth - 10);
                    const quoteHeight = quoteLines.length * 6;

                    // Draw background
                    pdf.setFillColor(245, 245, 245);
                    pdf.rect(margin, y - 3, contentWidth, quoteHeight + 6, 'F');

                    // Draw left border for blockquote
                    pdf.setDrawColor(180, 180, 180);
                    pdf.setLineWidth(3);
                    pdf.line(margin + 3, y - 3, margin + 3, y + quoteHeight + 3);
                    pdf.setLineWidth(0.5);

                    // Render formatted text
                    y += renderFormattedText(
                        blockquoteItem.text,
                        margin + 8,
                        y,
                        blockquoteItem.formatting,
                        contentWidth - 10
                    ) + 3;
                    break;

                case 'image':
                    // Images are not directly supported, add a placeholder text
                    const imageItem = item as ImageItem;
                    pdf.setFont('helvetica', 'italic');
                    pdf.text(`[Image: ${imageItem.alt || 'Image'}]`, margin, y);
                    pdf.setFont('helvetica', 'normal');
                    y += 8;
                    break;

                case 'hr':
                    // Add a horizontal rule with better styling
                    y += 3;
                    pdf.setDrawColor(150, 150, 150);
                    pdf.setLineWidth(0.7);
                    pdf.line(margin, y, margin + contentWidth, y);
                    y += 8;
                    break;

                case 'space':
                    // Add vertical space
                    y += 4;
                    break;
            }

            // Add a small gap between elements
            y += 3;
        }

        // Generate a unique filename
        const token = nanoid(6);

        // Save the PDF
        pdf.save(`${title.trim().toLowerCase().replace(/\s+/g, '-')}-${token}.pdf`);

        return true;
    } catch (error) {
        console.error('PDF generation error:', error);
        return false;
    }
} 