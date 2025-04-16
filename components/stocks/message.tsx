'use client'

/* eslint-disable @next/next/no-img-element */

import { GoogleIcon, IconGemini, IconUser } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { spinner } from './spinner'
import { CodeBlock } from '../ui/codeblock'
import { MemoizedReactMarkdown } from '../markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { StreamableValue } from 'ai/rsc'
import { useStreamableText } from '@/lib/hooks/use-streamable-text'
import { useState } from 'react'
import { Slide, ContentItem } from '@/lib/types'
import PresentationSlides from '@/components/slides/PresentationSlides'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { DownloadIcon, EnterFullScreenIcon, ViewHorizontalIcon } from '@radix-ui/react-icons'
import { Button } from '../ui/button'


// Different types of message bubbles.
export function UserMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="group relative flex items-center justify-end md:-ml-12">
      <div className="mr-4 flex-1 space-y-2 overflow-hidden pr-2 text-right flex justify-end">
        {children}
      </div>
      <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
        <IconUser />
      </div>
    </div>
  );
}

export function BotMessage({
  content,
  className
}: {
  content: string | StreamableValue<string>
  className?: string
}) {
  const text = useStreamableText(content)

  return (
    <div className={cn('group relative flex items-start md:-ml-12', className)}>
      <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
        <MemoizedReactMarkdown
          className="prose break-words dark:prose-invert prose-p:leading-relaxed prose-pre:p-0"
          remarkPlugins={[remarkGfm, remarkMath]}
          components={{
            p({ children }) {
              return <p className="mb-2 last:mb-0">{children}</p>
            },
            code({ node, inline, className, children, ...props }) {
              if (children.length) {
                if (children[0] == '▍') {
                  return (
                    <span className="mt-1 animate-pulse cursor-default">▍</span>
                  )
                }

                children[0] = (children[0] as string).replace('`▍`', '▍')
              }

              const match = /language-(\w+)/.exec(className || '')

              if (inline) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              }

              return (
                <CodeBlock
                  key={Math.random()}
                  language={(match && match[1]) || ''}
                  value={String(children).replace(/\n$/, '')}
                  {...props}
                />
              )
            }

          }}

        >
          {text}
        </MemoizedReactMarkdown>
      </div>
    </div>
  )
}

// Tool result components
export function ToolImages({ imageUrl, className }: { imageUrl: string; className?: string }) {
  const handleFullScreen = () => {
    window.open(imageUrl, '_blank');
  };

  return (
    <div className={`w-fit rounded-lg border border-gray-200 flex flex-col ${className}`}>
      <img
        src={imageUrl || "/placeholder.svg"}
        alt="Generated image"
        className="rounded-t-lg size-[200px] object-contain transition-all duration-300 ease-in-out"
      />
      <Button
        variant="outline"
        onClick={handleFullScreen}
        className="rounded-lg p-1.5 shadow-sm ease-in-out border border-gray-100"
        title="Download image"
        aria-label="Download image"
      >
        <EnterFullScreenIcon className="h-4 w-4" />
        <span className="sr-only">Full screen</span>
      </Button>
    </div>
  )
}

export function ToolMessage({
  content,
  className,
  toolCallMeta
}: {
  content: string | StreamableValue<string>,
  toolCallMeta: { concisedQuery: string, linksArray: [] },
  className?: string
}) {
  const text = useStreamableText(content)

  const [dropdown, setDropdown] = useState(false)


  return (
    <div className={cn('group relative flex items-start md:-ml-12', className)}>
      <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
        {
          toolCallMeta && toolCallMeta.concisedQuery && toolCallMeta.concisedQuery.length > 0 && (
            <>
              <Accordion type="single" collapsible>
                <AccordionItem value="item-1">
                  <AccordionTrigger className='flex justify-start hover:no-underline text-gray-500  cursor-pointer py-[2px]'>
                    Searched {toolCallMeta.linksArray.length} sites
                  </AccordionTrigger>
                  <div className='h-2'></div>
                  <AccordionContent className='text-gray-500 border border-gray-300 rounded-md shadow-lg pb-0'>
                    <a href={`https://www.bing.com/search?q=${encodeURIComponent(toolCallMeta.concisedQuery)}`} target='_blank' className='border-b border-gray-300 flex text-sm text-gray-500 hover:bg-gray-100 transition p-4 rounded-sm ' rel="noopener noreferrer">
                      <img className="w-6 h-6 object-contain mx-2 scale-75" src="/images/search.png" alt="gemini logo" />
                      <div className='flex flex-col'>
                        <span className='text-sm'>{toolCallMeta.concisedQuery}</span>
                        <span className='text-xs'>bing.com</span>
                      </div>
                    </a>
                    {toolCallMeta.linksArray.map((linkMeta: { link: string, name: string }, index) => {
                      return (
                        <a href={linkMeta.link} key={index} className='border-b border-gray-300 flex text-sm text-gray-500 hover:bg-gray-100 transition-transform p-4 rounded-sm' target="_blank" rel="noopener noreferrer">
                          <img className="w-6 h-6 object-contain mx-2 scale-75" src="/images/search.png" alt="gemini logo" />
                          <div className='flex flex-col'>
                            <span className='text-sm'>{linkMeta.name}</span>
                            <span className='text-xs'>{linkMeta.link}</span>
                          </div>
                        </a>
                      );
                    })}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          )
        }
        <MemoizedReactMarkdown
          className="prose break-words dark:prose-invert prose-p:leading-relaxed prose-pre:p-0"
          remarkPlugins={[remarkGfm, remarkMath]}
          components={{
            p({ children }) {
              return <p className="mb-2 last:mb-0">{children}</p>
            },
            code({ node, inline, className, children, ...props }) {
              if (children.length) {
                if (children[0] == '▍') {
                  return (
                    <span className="mt-1 animate-pulse cursor-default">▍</span>
                  )
                }

                children[0] = (children[0] as string).replace('`▍`', '▍')
              }

              const match = /language-(\w+)/.exec(className || '')

              if (inline) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              }

              return (
                <CodeBlock
                  key={Math.random()}
                  language={(match && match[1]) || ''}
                  value={String(children).replace(/\n$/, '')}
                  {...props}
                />
              )
            },
            a({ href, children, ...props }) {
              return (
                <a href={href} target='_blank'>
                  {children}
                </a>
              )
            }
          }}
        >
          {text}
        </MemoizedReactMarkdown>
      </div>
    </div>
  )
}

export function BotCard({
  children,
  showAvatar = true
}: {
  children: React.ReactNode
  showAvatar?: boolean
}) {
  return (
    <div className="group relative flex items-start md:-ml-12">
      <div
        className={cn(
          'bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm',
          !showAvatar && 'invisible'
        )}
      >
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 flex-1 pl-2">{children}</div>
    </div>
  )
}

export function SystemMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={
        'mt-2 flex items-center justify-center gap-2 text-xs text-gray-500'
      }
    >
      <div className={'max-w-[600px] flex-initial p-2'}>{children}</div>
    </div>
  )
}

export function ArxivToolMessage({
  content,
  className,
  query
}: {
  content: string | StreamableValue<string>,
  query: string,
  className?: string
}) {
  const text = useStreamableText(content)

  return (
    <div className={cn('group relative flex items-start md:-ml-12', className)}>
      <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
        {query && (
          <a href='https://arxiv.org/' target='_blank' className='cursor-pointer flex justify-between items-center px-4 py-4 border border-gray-200 rounded-lg w-[98%] min-h-12 text-gray-500'>
            <div className='flex'>
              <img className="mx-1 w-6 h-6 object-contain scale-75" src="/images/search.png" alt="gemini logo" />
              <p>{query}</p>
            </div>
            <div className='text-xs flex flex-col justify-end text-right'>
              <p className='border-b border-gray-200'>arXiv.org</p>
              <p>Free&nbsp;scholarly&nbsp;repository</p>
            </div>
          </a>
        )}
        <MemoizedReactMarkdown
          className="prose break-words dark:prose-invert prose-p:leading-relaxed prose-pre:p-0"
          remarkPlugins={[remarkGfm, remarkMath]}
          components={{
            p({ children }) {
              return <p className="mb-2 last:mb-0">{children}</p>
            },
            code({ node, inline, className, children, ...props }) {
              if (children.length) {
                if (children[0] == '▍') {
                  return (
                    <span className="mt-1 animate-pulse cursor-default">▍</span>
                  )
                }

                children[0] = (children[0] as string).replace('`▍`', '▍')
              }

              const match = /language-(\w+)/.exec(className || '')

              if (inline) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              }

              return (
                <CodeBlock
                  key={Math.random()}
                  language={(match && match[1]) || ''}
                  value={String(children).replace(/\n$/, '')}
                  {...props}
                />
              )
            },
            a({ href, children, ...props }) {
              return (
                <a href={href} target='_blank'>
                  {children}
                </a>
              )
            }
          }}
        >
          {text}
        </MemoizedReactMarkdown>
      </div>
    </div>
  )
}

export function WikipediaToolMessage({
  content,
  className,
  query
}: {
  content: string | StreamableValue<string>,
  query: string,
  className?: string
}) {
  const text = useStreamableText(content)

  return (
    <div className={cn('group relative flex items-start md:-ml-12', className)}>
      <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
        {query && (
          <a href={`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`} target='_blank' className='cursor-pointer flex justify-between items-center px-4 py-4 border border-gray-200 rounded-lg w-[98%] min-h-12 text-gray-500'>
            <div className='flex'>
              <p>{query}</p>
            </div>
            <div className='text-xs flex flex-col justify-end text-right'>
              <p className='border-b border-gray-200'>Wikipedia.org</p>
              <p>Free&nbsp;encyclopedia</p>
            </div>
          </a>
        )}
        <MemoizedReactMarkdown
          className="prose break-words dark:prose-invert prose-p:leading-relaxed prose-pre:p-0"
          remarkPlugins={[remarkGfm, remarkMath]}
          components={{
            p({ children }) {
              return <p className="mb-2 last:mb-0">{children}</p>
            },
            code({ node, inline, className, children, ...props }) {
              if (children.length) {
                if (children[0] == '▍') {
                  return (
                    <span className="mt-1 animate-pulse cursor-default">▍</span>
                  )
                }

                children[0] = (children[0] as string).replace('`▍`', '▍')
              }

              const match = /language-(\w+)/.exec(className || '')

              if (inline) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              }

              return (
                <CodeBlock
                  key={Math.random()}
                  language={(match && match[1]) || ''}
                  value={String(children).replace(/\n$/, '')}
                  {...props}
                />
              )
            },
            a({ href, children, ...props }) {
              return (
                <a href={href} target='_blank'>
                  {children}
                </a>
              )
            }
          }}
        >
          {text}
        </MemoizedReactMarkdown>
      </div>
    </div>
  )
}


//Tool loading components
export function SpinnerMessage() {
  return (
    <div className="group relative flex items-start md:-ml-12">
      <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 h-[24px] flex flex-row items-center flex-1 space-y-2 overflow-hidden px-1">
        {spinner}
      </div>
    </div>
  )
}

interface ToolLoadingAnimateProps extends React.PropsWithChildren<{}> { searchQuery?: string; }
export function ToolLoadingAnimate({ children, searchQuery }: ToolLoadingAnimateProps) {
  return (
    <div className={cn('group relative flex items-start md:-ml-12')}>
      <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
        <div className="animate-pulse">{children} {searchQuery && `("${searchQuery}")`}</div>
      </div>
    </div>
  )
}

export function ToolCallLoading({ concisedQuery }: { concisedQuery: String }) {
  return (
    <div className={cn('group relative flex items-start md:-ml-12')}>
      <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
        <div className="animate-pulse">Searching the web for {concisedQuery.length > 0 ? `"${concisedQuery}"` : "result"}</div>
      </div>
    </div>
  )
}

export function ToolImageLoading() {
  return (
    <div className={cn('group relative flex items-start md:-ml-12')}>
      <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
        <div className="animate-pulse">Generating images ...</div>
      </div>
    </div>
  )
}

export function ToolWikipediaLoading({ query }: { query: string }) {
  return (
    <div className={cn('group relative flex items-start md:-ml-12')}>
      <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
        <div className="animate-pulse">Searching Wikipedia for {query.length > 0 ? `"${query}"` : "information"}</div>
      </div>
    </div>
  )
}

export function SlideToolMessage({
  content,
  className,
  slides
}: {
  content: string | StreamableValue<string>,
  slides: Slide[],
  className?: string
}) {
  const text = useStreamableText(content)

  return (
    <div className={cn('group relative flex items-start md:-ml-12', className)}>
      <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
        <div className="rounded-lg h-[500px] aspect-16/9 w-full">
          <PresentationSlides slides={slides} />
        </div>
        <MemoizedReactMarkdown
          className="prose break-words dark:prose-invert prose-p:leading-relaxed prose-pre:p-0"
          remarkPlugins={[remarkGfm, remarkMath]}
          components={{
            p({ children }) {
              return <p className="mb-2 last:mb-0">{children}</p>
            },
            code({ node, inline, className, children, ...props }) {
              if (children.length) {
                if (children[0] == '▍') {
                  return (
                    <span className="mt-1 animate-pulse cursor-default">▍</span>
                  )
                }

                children[0] = (children[0] as string).replace('`▍`', '▍')
              }

              const match = /language-(\w+)/.exec(className || '')

              if (inline) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              }

              return (
                <CodeBlock
                  key={Math.random()}
                  language={(match && match[1]) || ''}
                  value={String(children).replace(/\n$/, '')}
                  {...props}
                />
              )
            }
          }}
        >
          {text}
        </MemoizedReactMarkdown>
      </div>
    </div>
  )
}

export function ToolSlideLoading({ topic }: { topic: string }) {
  return (
    <div className={cn('group relative flex items-start md:-ml-12')}>
      <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
        <div className="animate-pulse">Generating slides for {topic.length > 0 ? `"${topic}"` : "presentation"}</div>
      </div>
    </div>
  )
}