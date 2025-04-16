"use client"

import React, { useState, useEffect, useMemo } from 'react';
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
    Quote,
    ListIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slide, ContentItem } from '@/lib/types';

// Color options for different slide types
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

    const slideColors = useMemo(() => {
        const getRandomItem = (array: string[]) => array[Math.floor(Math.random() * array.length)];

        if (!slides || slides.length === 0) return {};

        const colors: Record<string, string> = {};

        slides.forEach((slide, index) => {
            const id = `${slide.type}-${index}`;
            if (slide.type === 'title') {
                colors[id] = getRandomItem(titleGradients);
            } else if (slide.type === 'conclusion') {
                colors[id] = getRandomItem(conclusionGradients);
            }
        });

        return colors;
    }, [slides]);

    if (!slides || slides.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No slides available</p>
            </div>
        );
    }

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

    const getSlideBackground = (type: string, index: number) => {
        const id = `${type}-${index}`;

        if (type === 'title') {
            return slideColors[id] || titleGradients[0];
        } else if (type === 'conclusion') {
            return slideColors[id] || conclusionGradients[0];
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

    const formatMarkdown = (text: string, slideType: string) => {
        return text
            .replace(/\*\*(.*?)\*\*/g, `<strong class="font-bold ${getTextColor(slideType) === 'text-white' ? 'text-white' : 'text-blue-600'}"">$1</strong>`)
            .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    };

    const formatContentItem = (item: ContentItem, idx: number, slideType: string) => {
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
                if (!item.list || item.list.length === 0) return null;

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

            default:
                return null;
        }
    };

    const currentSlideData = slides[currentSlide];

    const renderTitleSlideContent = () => {
        const paragraphItem = currentSlideData.content.find(item => item.type === 'paragraph');
        return paragraphItem && paragraphItem.content ? paragraphItem.content : '';
    };

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
                        className={`h-full w-full flex flex-col ${getSlideBackground(currentSlideData.type, currentSlide)}`}
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
                                    <p className="text-base opacity-90 max-w-2xl">
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
                    onClick={() => {
                        if (currentSlide > 0) {
                            setCurrentSlide(currentSlide - 1);
                        }
                    }}
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
                    onClick={() => {
                        if (currentSlide < slides.length - 1) {
                            setCurrentSlide(currentSlide + 1);
                        }
                    }}
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