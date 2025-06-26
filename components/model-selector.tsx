'use client'
import React, { useState } from 'react'
import { useModel } from '@/app/context/ModelContext'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface ModelOption {
  value: string
  label: string
  description: string
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
    value: 'o3-mini',
    label: 'GPT o3-mini',
    description: 'Latest GPT model with enhanced reasoning capabilities'
  },
  {
    value: 'o4-mini-2025-04-16',
    label: 'GPT o4-mini',
    description: 'Compact and efficient version of the latest GPT model'
  },
  {
    value: 'gpt-4.1-mini',
    label: 'GPT-4.1 Mini',
    description: 'Smaller, faster version of GPT-4.1 with good efficiency'
  },
  {
    value: 'gpt-4.1-nano',
    label: 'GPT-4.1 Nano',
    description: 'Ultra-compact GPT-4.1 variant optimized for speed'
  },
  {
    value: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    description: 'Balanced, small, excellent for general use'
  },
  {
    value: 'gpt-4o-2024-05-13',
    label: 'GPT-4o',
    description: 'Balanced, excellent for analytics and data'
  },
  {
    value: 'gpt-4.1-2025-04-14',
    label: 'GPT-4.1',
    description: 'Latest and most advanced GPT model with enhanced capabilities'
  },
  {
    value: 'claude-opus-4-20250514',
    label: 'Claude Opus 4',
    description: 'Our most capable model.'
  },
  {
    value: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet 4',
    description: 'High-performance model.'
  },
  {
    value: 'claude-3-7-sonnet-latest',
    label: 'Claude 3.7 Sonnet',
    description: 'High-performance model with early extended thinking.'
  },
  {
    value: 'claude-3-5-sonnet-20240620',
    label: 'Claude 3.5 Sonnet',
    description: 'Our previous intelligent model'
  },

  {
    value: 'llama3-70b-8192',
    label: 'Llama 3',
    description: 'Robust, handles large context well'
  },
  {
    value: 'gemini',
    label: 'Gemini',
    description: 'Versatile, suitable for diverse tasks'
  },
  {
    value: 'gemma-7b-it',
    label: 'Gemma',
    description: '❗Compact, efficient for smaller files'
  },
  {
    value: 'mixtral-8x7b-32768',
    label: 'Mixtral',
    description: '❗Innovative, ideal for creative projects'
  }
]

export function ModelSelector() {
  const { model, setModel } = useModel()
  const [tooltipContent, setTooltipContent] = useState<string>('')
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number }>({
    top: 0
  })

  const handleMouseEnter = (
    description: string,
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipContent(description)
    setTooltipPosition({ top: rect.top })
  }

  const handleValueChange = (value: string) => {
    setModel(value)
    setTooltipContent('')
  }

  return (
    <div className="relative">
      <Select defaultValue={model} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Model</SelectLabel>
            {MODEL_OPTIONS.map(option => (
              <SelectItem
                key={option.value}
                value={option.value}
                onMouseEnter={e => handleMouseEnter(option.description, e)}
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
  )
}
