import { jsPDF } from "jspdf";
import { nanoid } from "nanoid";

// Define interfaces for parsed markdown items
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
    const lines = markdown.split('\n');
    const result: MarkdownItem[] = [];
    let inCodeBlock = false;
    let codeContent = '';

    // Helper function to process inline formatting
    const processInlineFormatting = (text: string) => {
        return {
            plainText: text
                // Remove markdown formatting but preserve content
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/__(.*?)__/g, '$1')
                .replace(/\*(.*?)\*/g, '$1')
                .replace(/_(.*?)_/g, '$1')
                .replace(/`(.*?)`/g, '$1')
                .replace(/\[(.*?)]\((.*?)\)/g, '$1 ($2)'),

            // Track formatting positions for rendering
            boldRanges: [...text.matchAll(/\*\*(.*?)\*\*/g), ...text.matchAll(/__(.*?)__/g)]
                .map(match => ({
                    text: match[1],
                    index: match.index || 0,
                    length: match[1].length
                })),

            linkRanges: [...text.matchAll(/\[(.*?)]\((.*?)\)/g)]
                .map(match => ({
                    text: match[1],
                    url: match[2],
                    index: match.index || 0,
                    length: match[0].length
                }))
        };
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Handle code blocks
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                // End of code block
                result.push({
                    type: 'code',
                    text: codeContent.trim()
                } as CodeItem);
                codeContent = '';
                inCodeBlock = false;
            } else {
                // Start of code block
                inCodeBlock = true;
            }
            continue;
        }

        if (inCodeBlock) {
            codeContent += line + '\n';
            continue;
        }

        // Skip empty lines but add space markers
        if (!line.trim()) {
            result.push({ type: 'space' } as SpaceItem);
            continue;
        }

        // Handle headings
        if (line.startsWith('#')) {
            const match = line.match(/^(#+)\s+(.+)$/);
            if (match) {
                const headingText = match[2].trim();
                const { plainText, boldRanges } = processInlineFormatting(headingText);

                result.push({
                    type: 'heading',
                    level: match[1].length,
                    text: plainText,
                    formatting: { boldRanges }
                } as any);
                continue;
            }
        }

        // Handle list items (unordered)
        if (line.trim().match(/^[-*+]\s+/)) {
            const listItemText = line.replace(/^[-*+]\s+/, '').trim();
            const { plainText, boldRanges, linkRanges } = processInlineFormatting(listItemText);

            result.push({
                type: 'list-item',
                text: plainText,
                formatting: { boldRanges, linkRanges }
            } as any);
            continue;
        }

        // Handle list items (ordered)
        const orderedListMatch = line.trim().match(/^(\d+)\.\s+(.+)$/);
        if (orderedListMatch) {
            const numberedItemText = orderedListMatch[2].trim();
            const { plainText, boldRanges, linkRanges } = processInlineFormatting(numberedItemText);

            result.push({
                type: 'numbered-list-item',
                number: parseInt(orderedListMatch[1]),
                text: plainText,
                formatting: { boldRanges, linkRanges }
            } as any);
            continue;
        }

        // Handle blockquotes
        if (line.trim().startsWith('>')) {
            const blockquoteText = line.replace(/^>\s?/, '').trim();
            const { plainText, boldRanges, linkRanges } = processInlineFormatting(blockquoteText);

            result.push({
                type: 'blockquote',
                text: plainText,
                formatting: { boldRanges, linkRanges }
            } as any);
            continue;
        }

        // Handle horizontal rules
        if (line.trim().match(/^(\*{3,}|-{3,}|_{3,})$/)) {
            result.push({ type: 'hr' } as HorizontalRuleItem);
            continue;
        }

        // Handle images
        const imageMatch = line.match(/!\[(.*?)]\((.*?)\)/);
        if (imageMatch) {
            result.push({
                type: 'image',
                alt: imageMatch[1] || '',
                url: imageMatch[2] || ''
            } as ImageItem);
            continue;
        }

        // Regular paragraph
        const { plainText, boldRanges, linkRanges } = processInlineFormatting(line.trim());
        result.push({
            type: 'paragraph',
            text: plainText,
            formatting: { boldRanges, linkRanges }
        } as any);
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
    console.log(content)
    try {
        // Create jsPDF instance
        const pdf = new jsPDF();

        // Set up PDF document
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);
        let y = margin;

        // Add title
        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        pdf.text(title, margin, y);
        y += 15;

        // Parse and process the markdown content
        const parsedContent = parseMarkdownForPDF(content);

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

                        y += heightUsed + (fontSize / 3);
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

                    // Add text with proper indentation and formatting
                    y += renderFormattedText(
                        listItem.text,
                        listIndent + bulletWidth,
                        y,
                        listItem.formatting,
                        listContentWidth
                    );
                    break;

                case 'numbered-list-item':
                    const numberedItem = item as any;
                    const numberedIndent = margin + 5;
                    const numberWidth = 8;
                    const numberedContentWidth = contentWidth - 10;

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