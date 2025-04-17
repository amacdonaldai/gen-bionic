"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
    ChevronLeft,
    ChevronRight,
    BookOpenText,
    BarChart2,
    PresentationIcon,
    Radio,
    FileText,
    SquareArrowRightIcon,
    CheckCircle2Icon,
    Quote,
    ImageIcon,
    Loader2,
    Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slide, ContentItem } from '@/lib/types';
import { generateImages } from '@/lib/chat/generateImage';
import { exportSlidesToPptx } from '@/lib/utils/slideExport';

// Color palettes for different slide types
const titleGradients = [
    'bg-gradient-to-br from-blue-600 to-blue-800',
    'bg-gradient-to-br from-purple-600 to-indigo-800',
    'bg-gradient-to-br from-indigo-600 to-blue-900',
    'bg-gradient-to-br from-blue-500 to-indigo-700',
    'bg-gradient-to-br from-violet-600 to-blue-700',
    'bg-gradient-to-br from-pink-600 to-purple-800',
    'bg-gradient-to-br from-cyan-600 to-blue-800',
    'bg-gradient-to-br from-slate-700 to-slate-900',
    'bg-gradient-to-br from-fuchsia-600 to-purple-800',
    'bg-gradient-to-br from-sky-600 to-indigo-800'
];

const conclusionGradients = [
    'bg-gradient-to-br from-green-600 to-green-800',
    'bg-gradient-to-br from-teal-600 to-emerald-800',
    'bg-gradient-to-br from-emerald-600 to-teal-800',
    'bg-gradient-to-br from-green-500 to-teal-700',
    'bg-gradient-to-br from-teal-500 to-green-700',
    'bg-gradient-to-br from-lime-600 to-green-800',
    'bg-gradient-to-br from-emerald-500 to-cyan-800',
    'bg-gradient-to-br from-green-600 to-emerald-900',
    'bg-gradient-to-br from-teal-600 to-green-900',
    'bg-gradient-to-br from-cyan-600 to-teal-800'
];

interface PresentationSlidesProps {
    slides: Slide[];
}

const PresentationSlides: React.FC<PresentationSlidesProps> = ({ slides = [] }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [processedSlides, setProcessedSlides] = useState<Slide[]>(slides);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Process slides and generate images on mount
    useEffect(() => {
        async function processSlides() {
            // Check if any slides need image generation
            const hasImagePrompts = slides.some(slide =>
                slide.content.some(item =>
                    item.type === 'image' && item.imagePrompt && !item.imageUrl
                )
            );

            if (!hasImagePrompts || slides.length === 0) {
                setProcessedSlides(slides);
                return;
            }

            setIsLoading(true);

            try {
                // Extract image prompts
                const prompts: string[] = [];
                const promptMap: { slideIndex: number, contentIndex: number }[] = [];

                slides.forEach((slide, slideIndex) => {
                    slide.content.forEach((item, contentIndex) => {
                        if (item.type === 'image' && item.imagePrompt && !item.imageUrl) {
                            prompts.push(item.imagePrompt);
                            promptMap.push({ slideIndex, contentIndex });
                        }
                    });
                });

                if (prompts.length === 0) {
                    setProcessedSlides(slides);
                    return;
                }

                // Generate images
                const imageUrls = await generateImages(prompts);

                // Update slides with image URLs
                const newSlides = JSON.parse(JSON.stringify(slides));

                imageUrls.forEach((url, index) => {
                    if (url && promptMap[index]) {
                        const { slideIndex, contentIndex } = promptMap[index];
                        if (newSlides[slideIndex]?.content[contentIndex]) {
                            newSlides[slideIndex].content[contentIndex].imageUrl = url;
                        }
                    }
                });

                setProcessedSlides(newSlides);
            } catch (error) {
                console.error('Error generating images:', error);
                setProcessedSlides(slides);
            } finally {
                setIsLoading(false);
            }
        }

        processSlides();
    }, [slides]);

    // Handle download of slides as PowerPoint
    const handleDownload = async () => {
        if (isExporting || !processedSlides.length) return;

        setIsExporting(true);
        try {
            // Get presentation title from first slide or use default
            const title = processedSlides[0]?.title || 'Presentation';

            // Export slides to PowerPoint
            const pptxBlob = await exportSlidesToPptx(processedSlides, title);

            // Create download link
            const url = URL.createObjectURL(pptxBlob as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title.replace(/[^\w\s]/gi, '')}.pptx`;
            document.body.appendChild(a);
            a.click();

            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        } catch (error) {
            console.error('Error exporting to PowerPoint:', error);
            alert('Failed to download presentation. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    // Memoize random gradient colors for slides
    const slideColors = useMemo(() => {
        if (!processedSlides?.length) return {};

        const colors: Record<string, string> = {};
        const getRandomItem = (array: string[]) => array[Math.floor(Math.random() * array.length)];

        processedSlides.forEach((slide, index) => {
            const id = `${slide.type}-${index}`;
            if (slide.type === 'title') {
                colors[id] = getRandomItem(titleGradients);
            } else if (slide.type === 'conclusion') {
                colors[id] = getRandomItem(conclusionGradients);
            }
        });

        return colors;
    }, [processedSlides]);

    // Loading state
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full border border-gray-200 rounded-xl shadow-sm">
                <Loader2 strokeWidth={1} className="h-12 w-12 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-600 text-sm">Preparing your presentation...</p>
            </div>
        );
    }

    // Empty state
    if (!processedSlides?.length) {
        return (
            <div className="flex items-center justify-center h-full border border-gray-200 rounded-xl shadow-sm">
                <p className="text-gray-500">No slides available</p>
            </div>
        );
    }

    const currentSlideData = processedSlides[currentSlide];

    return (
        <div className="relative h-full flex flex-col">
            {/* Slide content */}
            <div className="flex-1 overflow-hidden mb-4 border border-gray-200 rounded-xl shadow-sm">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentSlide}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className={`h-full w-full flex flex-col ${getSlideBackground(currentSlideData.type, currentSlide, slideColors)}`}
                    >
                        <SlideContent slideData={currentSlideData} />
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation controls */}
            <div className="flex justify-between items-center mt-auto">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => currentSlide > 0 && setCurrentSlide(currentSlide - 1)}
                    disabled={currentSlide === 0}
                    className="rounded-full"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-2">
                    <div className="text-sm text-gray-500">
                        {currentSlide + 1} / {processedSlides.length}
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownload}
                        disabled={isExporting || isLoading}
                        className="ml-2 flex items-center gap-1"
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Exporting...</span>
                            </>
                        ) : (
                            <>
                                <Download className="h-3 w-3" />
                                <span>Download PPTX</span>
                            </>
                        )}
                    </Button>
                </div>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => currentSlide < processedSlides.length - 1 && setCurrentSlide(currentSlide + 1)}
                    disabled={currentSlide === processedSlides.length - 1}
                    className="rounded-full"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

// Helper components
const SlideContent = ({ slideData }: { slideData: Slide }) => {
    const { textContent, imageContent, hasImage } = splitSlideContent(slideData.content);
    const slideType = slideData.type;
    const textColor = getTextColor(slideType);

    if (slideType === 'title') {
        return <TitleSlide slideData={slideData} textContent={textContent} />;
    }

    return hasImage
        ? <SplitImageSlide slideData={slideData} textContent={textContent} imageContent={imageContent} />
        : <StandardSlide slideData={slideData} textContent={textContent} />;
};

const TitleSlide = ({ slideData, textContent }: { slideData: Slide, textContent: ContentItem[] }) => {
    const paragraphItem = slideData.content.find(item => item.type === 'paragraph');
    const textColor = getTextColor(slideData.type);

    return (
        <div className={`p-10 flex-1 flex flex-col items-center justify-center text-center ${textColor}`}>
            <div className="mb-6">
                {getIconForType(slideData.type)}
            </div>
            <h1 className="text-3xl font-bold mb-6">{slideData.title}</h1>
            <div className="w-24 h-1 bg-white opacity-70 rounded-full mb-6"></div>
            {textContent.length > 0 && paragraphItem?.content && (
                <p className="text-base opacity-90 max-w-2xl">
                    {paragraphItem.content}
                </p>
            )}
        </div>
    );
};

const SplitImageSlide = ({
    slideData,
    textContent,
    imageContent
}: {
    slideData: Slide,
    textContent: ContentItem[],
    imageContent: ContentItem | undefined
}) => {
    const textColor = getTextColor(slideData.type);

    return (
        <div className={`p-8 flex-1 flex flex-col ${textColor}`}>
            <div className={`flex items-center mb-6 ${textColor === 'text-white' ? 'border-b border-white/20' : 'border-b border-gray-200'} pb-4`}>
                <div className={`mr-3 p-2 rounded-lg ${textColor === 'text-white' ? 'bg-white/10' : 'bg-blue-100'}`}>
                    {getIconForType(slideData.type)}
                </div>
                <h2 className="text-2xl font-bold">{slideData.title}</h2>
            </div>
            <div className="flex-1 flex overflow-hidden items-center">
                {/* Left side - Text content */}
                <div className="w-1/2 pr-4 overflow-auto custom-scrollbar">
                    {textContent.map((contentItem, idx) =>
                        formatContentItem(contentItem, idx, slideData.type)
                    )}
                </div>

                {/* Right side - Image */}
                <div className="w-1/2 pl-4 flex items-center">
                    {imageContent && formatContentItem(imageContent, 999, slideData.type)}
                </div>
            </div>
        </div>
    );
};

const StandardSlide = ({ slideData, textContent }: { slideData: Slide, textContent: ContentItem[] }) => {
    const textColor = getTextColor(slideData.type);

    return (
        <div className={`p-8 flex-1 flex flex-col ${textColor}`}>
            <div className={`flex items-center mb-6 ${textColor === 'text-white' ? 'border-b border-white/20' : 'border-b border-gray-200'} pb-4`}>
                <div className={`mr-3 p-2 rounded-lg ${textColor === 'text-white' ? 'bg-white/10' : 'bg-blue-100'}`}>
                    {getIconForType(slideData.type)}
                </div>
                <h2 className="text-2xl font-bold">{slideData.title}</h2>
            </div>
            <div className="flex-1 overflow-auto pr-4 custom-scrollbar">
                {textContent.map((contentItem, idx) =>
                    formatContentItem(contentItem, idx, slideData.type)
                )}
            </div>
        </div>
    );
};

// Helper functions
function getIconForType(type: Slide['type']) {
    switch (type) {
        case 'title': return <PresentationIcon className="h-8 w-8" />;
        case 'overview': return <BookOpenText className="h-8 w-8" />;
        case 'detail': return <FileText className="h-8 w-8" />;
        case 'comparison': return <Radio className="h-8 w-8" />;
        case 'statistics': return <BarChart2 className="h-8 w-8" />;
        case 'case-study': return <SquareArrowRightIcon className="h-8 w-8" />;
        case 'conclusion': return <CheckCircle2Icon className="h-8 w-8" />;
        default: return <PresentationIcon className="h-8 w-8" />;
    }
}

function getSlideBackground(type: string, index: number, colors: Record<string, string>) {
    const id = `${type}-${index}`;

    if (type === 'title') {
        return colors[id] || titleGradients[0];
    } else if (type === 'conclusion') {
        return colors[id] || conclusionGradients[0];
    } else {
        return 'bg-white';
    }
}

function getTextColor(type: string) {
    return (type === 'title' || type === 'conclusion') ? 'text-white' : 'text-gray-800';
}

function formatMarkdown(text: string, slideType: string) {
    return text
        .replace(/\*\*(.*?)\*\*/g, `<strong class="font-bold ${getTextColor(slideType) === 'text-white' ? 'text-white' : 'text-blue-600'}"">$1</strong>`)
        .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
}

function splitSlideContent(content: ContentItem[]) {
    const textContent = content.filter(item => item.type !== 'image');
    const imageContent = content.find(item => item.type === 'image');
    return { textContent, imageContent, hasImage: !!imageContent };
}

function formatContentItem(item: ContentItem, idx: number, slideType: string) {
    switch (item.type) {
        case 'paragraph':
            if (!item.content) return null;

            return (
                <p
                    key={idx}
                    className="mb-4 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(item.content, slideType) }}
                />
            );

        case 'list':
            if (!item.list?.length) return null;

            return (
                <div key={idx} className="mb-4 flex flex-col space-y-2">
                    {item.list.map((listItem, listIdx) => (
                        <div key={`${idx}-${listIdx}`} className="flex items-start">
                            <div className="flex items-center mr-2 text-blue-500 text-lg">
                                {"•"}
                            </div>
                            <div
                                className="flex-1"
                                dangerouslySetInnerHTML={{
                                    __html: formatMarkdown(listItem, slideType)
                                }}
                            />
                        </div>
                    ))}
                </div>
            );

        case 'quote':
            if (!item.quote) return null;

            return (
                <div key={idx} className={`mb-4 pl-4 border-l-4 ${getTextColor(slideType) === 'text-white' ? 'border-white/60' : 'border-blue-400'} italic`}>
                    <div className="flex items-start gap-2">
                        <Quote className={`h-4 w-4 mt-1.5 flex-shrink-0 ${getTextColor(slideType) === 'text-white' ? 'text-white/80' : 'text-blue-500'}`} />
                        <div dangerouslySetInnerHTML={{ __html: formatMarkdown(item.quote, slideType) }} />
                    </div>
                </div>
            );

        case 'image':
            if (!item.imageUrl) {
                return (
                    <div key={idx} className="h-full flex flex-col items-center justify-center">
                        <div className="border border-gray-200 rounded-lg p-4 w-full h-full bg-gray-50 flex flex-col items-center justify-center">
                            <ImageIcon className="h-10 w-10 text-gray-400 mb-2" />
                        </div>
                    </div>
                );
            }

            return (
                <div key={idx} className="h-full flex flex-col items-center justify-center">
                    <div className="relative w-full h-full overflow-hidden rounded-lg">
                        <Image
                            src={item.imageUrl}
                            alt={item.imagePrompt || "Slide image"}
                            width={400}
                            height={400}
                            style={{ objectFit: 'contain' }}
                            className="rounded-lg"
                            priority={true}
                        />
                    </div>
                </div>
            );

        default:
            return null;
    }
}

export default PresentationSlides; 