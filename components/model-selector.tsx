'use client';
import React, { useState } from "react";
import { useModel } from '@/app/context/ModelContext';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModelOption {
  value: string;
  label: string;
  description: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  // {
  //   value: "o1-preview",
  //   label: "o1-preview",
  //   description: "reasoning model designed to solve hard problems across domains."
  // },
  // {
  //   value: "o1-mini",
  //   label: "o1-mini",
  //   description: "faster and cheaper reasoning model particularly good at coding, math, and science."
  // },
  {
    value: "gpt-4o-mini",
    label: "GPT-4o Mini",
    description: "Balanced, small, excellent for general use"
  },
  {
    value: "gpt-4o-2024-05-13",
    label: "GPT-4o",
    description: "Balanced, excellent for analytics and data"
  },
  {
    value: "gpt-4.1-2025-04-14",
    label: "GPT-4.1",
    description: "Latest and most advanced GPT model with enhanced capabilities"
  },
  {
    value: "claude-3-5-sonnet-20240620",
    label: "Claude 3.5 Sonnet",
    description: "Smartest of them all."
  },
  {
    value: "claude-3-7-sonnet-latest",
    label: "Claude 3.7 Sonnet",
    description: "Most advanced model with exceptional reasoning and coding capabilities."
  },
  {
    value: "llama3-70b-8192",
    label: "Llama 3",
    description: "Robust, handles large context well"
  },
  {
    value: "gemini",
    label: "Gemini",
    description: "Versatile, suitable for diverse tasks"
  },
  {
    value: "gemma-7b-it",
    label: "Gemma",
    description: "❗Compact, efficient for smaller files"
  },
  {
    value: "mixtral-8x7b-32768",
    label: "Mixtral",
    description: "❗Innovative, ideal for creative projects"
  },
];

export function ModelSelector() {
  const { model, setModel } = useModel();
  const [tooltipContent, setTooltipContent] = useState<string>('');
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number }>({ top: 0 });

  const handleMouseEnter = (description: string, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipContent(description);
    setTooltipPosition({ top: rect.top });
  };

  const handleValueChange = (value: string) => {
    setModel(value);
    setTooltipContent('');
  };

  return (
    <div className="relative">
      <Select defaultValue={model} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Model</SelectLabel>
            {MODEL_OPTIONS.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                onMouseEnter={(e) => handleMouseEnter(option.description, e)}
                onMouseLeave={() => setTooltipContent('')}
                className="cursor-pointer"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {tooltipContent && (
        <div
          className="absolute left-full ml-2 mt-[-1rem] bg-[#f4f4f5] text-black text-xs p-2 rounded w-64"
          style={{ top: tooltipPosition.top }}
        >
          {tooltipContent}
        </div>
      )}
    </div>
  );
}
