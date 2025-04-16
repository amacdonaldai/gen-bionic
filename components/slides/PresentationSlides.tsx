"use client"

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
    Quote
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slide, ContentItem } from '@/lib/types';

interface PresentationSlidesProps {
    slides: Slide[];
}

const PresentationSlides: React.FC<PresentationSlidesProps> = ({ slides = [] }) => {
    const [currentSlide, setCurrentSlide] = useState(0);

    const nextSlide = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(currentSlide + 1);
        }
    };

    const prevSlide = () => {
        if (currentSlide > 0) {
            setCurrentSlide(currentSlide - 1);
        }
    };

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                nextSlide();
            } else if (e.key === 'ArrowLeft') {
                prevSlide();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [currentSlide, slides.length]);

    if (!slides || slides.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No slides available</p>
            </div>
        );
    }

    // Get the icon for the slide type
    const getIconForType = (type: Slide['type']) => {
        switch (type) {
            case 'title':
                return <PresentationIcon className="h-8 w-8" />;
            case 'overview':
                return <BookOpenText className="h-8 w-8" />;
            case 'detail':
                return <FileText className="h-8 w-8" />;
            case 'comparison':
                return <Radio className="h-8 w-8" />;
            case 'statistics':
                return <BarChart2 className="h-8 w-8" />;
            case 'case-study':
                return <SquareArrowRightIcon className="h-8 w-8" />;
            case 'conclusion':
                return <CheckCircle2Icon className="h-8 w-8" />;
            default:
                return <PresentationIcon className="h-8 w-8" />;
        }
    };

    // Get styling based on slide type
    const getSlideBackground = (type: string) => {
        if (type === 'title') {
            return 'bg-gradient-to-br from-blue-600 to-blue-800';
        } else if (type === 'conclusion') {
            return 'bg-gradient-to-br from-green-600 to-green-800';
        } else {
            return 'bg-white';
        }
    };

    const getTextColor = (type: string) => {
        if (type === 'title' || type === 'conclusion') {
            return 'text-white';
        } else {
            return 'text-gray-800';
        }
    };

    // Format content with markdown-style formatting
    const formatContentItem = (item: ContentItem, idx: number, slideType: string) => {
        const formattedContent = item.content
            .replace(/\*\*(.*?)\*\*/g, `<strong class="font-bold ${getTextColor(slideType) === 'text-white' ? 'text-white' : 'text-blue-600'}"">$1</strong>`)
            .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

        switch (item.type) {
            case 'paragraph':
                return (
                    <p
                        key={idx}
                        className="mb-4 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: formattedContent }}
                    />
                );

            case 'bullet':
                return (
                    <div key={idx} className="flex mb-3">
                        <span className={`mr-3 mt-1.5 text-lg ${getTextColor(slideType) === 'text-white' ? 'text-white' : 'text-blue-500'}`}>•</span>
                        <div className="flex-1" dangerouslySetInnerHTML={{ __html: formattedContent }} />
                    </div>
                );

            case 'list':
                return (
                    <div key={idx} className="mb-4 ml-4">
                        <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
                    </div>
                );

            case 'quote':
                return (
                    <div key={idx} className={`mb-4 pl-4 border-l-4 ${getTextColor(slideType) === 'text-white' ? 'border-white/60' : 'border-blue-400'} italic`}>
                        <div className="flex items-start gap-2">
                            <Quote className={`h-4 w-4 mt-1.5 flex-shrink-0 ${getTextColor(slideType) === 'text-white' ? 'text-white/80' : 'text-blue-500'}`} />
                            <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
                        </div>
                    </div>
                );

            default:
                return (
                    <p key={idx} className="mb-4" dangerouslySetInnerHTML={{ __html: formattedContent }} />
                );
        }
    };

    const currentSlideData = slides[currentSlide];

    // Special handling for title slide
    const renderTitleSlideContent = () => {
        // For title slides, we'll display the first paragraph content item
        const paragraphItem = currentSlideData.content.find(item => item.type === 'paragraph');
        return paragraphItem ? paragraphItem.content : '';
    };

    return (
        <div className="relative p-4 h-full flex flex-col">
            {/* Slide content */}
            <div className="flex-1 overflow-hidden mb-4">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentSlide}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className={`h-full w-full rounded-xl shadow-lg flex flex-col ${getSlideBackground(currentSlideData.type)}`}
                    >
                        {currentSlideData.type === 'title' ? (
                            // Title slide layout
                            <div className={`p-10 flex-1 flex flex-col items-center justify-center text-center ${getTextColor(currentSlideData.type)}`}>
                                <div className="mb-6">
                                    {getIconForType(currentSlideData.type)}
                                </div>
                                <h1 className="text-3xl font-bold mb-6">{currentSlideData.title}</h1>
                                <div className="w-24 h-1 bg-white opacity-70 rounded-full mb-6"></div>
                                {currentSlideData.content.length > 0 && (
                                    <p className="text-xl opacity-90 max-w-2xl">
                                        {renderTitleSlideContent()}
                                    </p>
                                )}
                            </div>
                        ) : (
                            // Regular slide layout
                            <div className={`p-8 flex-1 flex flex-col ${getTextColor(currentSlideData.type)}`}>
                                <div className={`flex items-center mb-6 ${getTextColor(currentSlideData.type) === 'text-white' ? 'border-b border-white/20' : 'border-b border-gray-200'} pb-4`}>
                                    <div className={`mr-3 p-2 rounded-lg ${getTextColor(currentSlideData.type) === 'text-white' ? 'bg-white/10' : 'bg-blue-100'}`}>
                                        {getIconForType(currentSlideData.type)}
                                    </div>
                                    <h2 className="text-2xl font-bold">{currentSlideData.title}</h2>
                                </div>
                                <div className="flex-1 overflow-auto pr-4 custom-scrollbar">
                                    {currentSlideData.content.map((contentItem, idx) =>
                                        formatContentItem(contentItem, idx, currentSlideData.type)
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation controls */}
            <div className="flex justify-between items-center mt-auto">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={prevSlide}
                    disabled={currentSlide === 0}
                    className="rounded-full"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="text-sm text-gray-500">
                    {currentSlide + 1} / {slides.length}
                </div>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={nextSlide}
                    disabled={currentSlide === slides.length - 1}
                    className="rounded-full"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

export default PresentationSlides; 