// @ts-nocheck
import 'server-only'
import { anthropic } from '@ai-sdk/anthropic';
import { groq } from '@ai-sdk/groq';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai'
import { parseStringPromise } from 'xml2js';

import {
  createAI,
  createStreamableUI,
  createStreamableValue,
  getAIState,
  getMutableAIState,
  streamUI
} from 'ai/rsc'

import OpenAI from 'openai'

import {
  BotCard,
  BotMessage,
  Purchase,
  Stock,
  SystemMessage,
  spinner
} from '@/components/stocks'

import { saveChat, getChat } from '@/app/actions'
import { auth } from '@/auth'
import { Events } from '@/components/stocks/events'
import { SpinnerMessage, ToolCallLoading, ToolImageLoading, ToolImages, ToolMessage, UserMessage, ToolLoadingAnimate, ArxivToolMessage, ToolWikipediaLoading, WikipediaToolMessage, SlideToolMessage, ToolSlideLoading, ExportPdfButton, ResearchAgentLoading, ResearchAgentMessage } from '@/components/stocks/message'
import { Stocks } from '@/components/stocks/stocks'
import { Chat } from '@/lib/types'
import {
  formatNumber,
  nanoid,
  runAsyncFnWithoutBlocking,
  sleep
} from '@/lib/utils'

import { generateText, tool } from 'ai';
import { z } from 'zod';
import { executeWebSearch } from './websearch';
import { generateSlides } from './slideGenerator';
import { researchAgent } from './research-agent';

type TextPart = {
  type: 'text'
  text: string
}

type ImagePart = {
  type: 'image'
  image: string
}

type FilePart = {
  type: 'file'
  data: string
  mimeType: string
  name?: string
}

type MessageContent = TextPart | ImagePart | FilePart

type UserMessage = {
  id: string
  role: 'user'
  content: MessageContent[]
}

type AssistantMessage = {
  id: string
  role: 'assistant'
  content: string | Array<{
    type: 'text'
    text: string
    toolName?: string
    meta?: string
    slides?: any
  } | {
    type: 'tool-call'
    toolName: string
    toolCallId: string
    args: any
  }>
}

type SystemMessage = {
  id: string
  role: 'system'
  content: string
}

type ToolMessage = {
  id: string
  role: 'tool'
  content: Array<{
    type: 'tool-result'
    toolName: string
    toolCallId: string
    result: any
  }>
}

type Message = UserMessage | AssistantMessage | SystemMessage | ToolMessage

async function fetchArxiv(query, time) {
  console.log(query, time);
  try {
    const apiUrl = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(query + " " + time)}${time ? "&start=0&max_results=40" : ""}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      return "HTTP error!";
    }

    const xml = await response.text();
    const json = await parseStringPromise(xml);

    if (time) {
      let parsedDate;
      if (time.length === 4) parsedDate = new Date(time + '-01-01T00:00:00Z');
      else if (time.length === 7) parsedDate = new Date(time + '-01T00:00:00Z');
      else return "Invalid time format";

      if (!json || !json.feed || !json.feed.entry) return "No relevant data found";

      const filteredData = json.feed.entry.filter((it) => {
        const publishedDate = new Date(it.published[0]);
        return publishedDate >= parsedDate;
      });

      console.log(filteredData.length);

      if (filteredData.length === 0) return "No relevant data found within the specified time";
      return filteredData;
    } else {
      return json;
    }
  } catch (error) {
    console.error('Error fetching or converting data:', error);
    return "Something went wrong";
  }
}

const getFormattedDate = () => {
  const today = new Date();
  const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
  return today.toLocaleDateString('en-CA', options); // 'en-CA' locale formats date as YYYY-MM-DD
};

const getModel = (model: string) => {
  // OpenAI models
  if (model.startsWith('gpt') || model.startsWith('o3') || model.startsWith('o4-mini')) {
    return openai(model);
  }

  // Anthropic models
  if (model.startsWith('claude')) {
    return anthropic(model);
  }

  // Groq models
  const groqModels = ['llama3-70b-8192', 'gemma-7b-it', 'mixtral-8x7b-32768'];
  if (groqModels.includes(model)) {
    return groq(model);
  }

  // Google models
  if (model === 'gemini') {
    return google(model);
  }

  // Default to OpenAI if no specific provider matches
  return openai('gpt-4o');
}

async function submitUserMessage(
  content: string,
  model: string,
  images?: string[],
  pdfFiles?: { base64: string; name: string; mimeType: string }[],
  csvFiles?: { name: string; text: string }[]
) {
  'use server'

  const openaiOriginal = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const selectedModel = getModel(model);

  const aiState = getMutableAIState<typeof AI>()

  // Prepare the message content
  const messageContent: MessageContent[] = []

  if (content) {
    messageContent.push({ type: 'text', text: content })
  }

  if (pdfFiles && pdfFiles.length > 0) {
    pdfFiles.forEach(pdf => {
      messageContent.push({
        type: 'file',
        data: pdf.base64, // Using base64 encoded data
        mimeType: pdf.mimeType,
        name: pdf.name
      })
    })
  }

  if (images && images.length > 0) {
    images.forEach(image => {
      // Remove the base64 header if present
      const base64Image = image.split(',')[1]
      messageContent.push({ type: 'image', image: base64Image })
    })
  }

  if (csvFiles && csvFiles.length > 0) {
    csvFiles.forEach(file => {
      messageContent.push({
        type: 'text',
        // To ensure that AI reads this text in CSV formate
        text:
          'Treat the below text as csv data \n' +
          file.text +
          '\n Csv data ends here.'
      })
    })
  }


  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content: messageContent
      }
    ]
  })

  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
  let textNode: undefined | React.ReactNode

  const result = await streamUI({
    model: selectedModel,
    initial: <SpinnerMessage />,
    temperature: model.startsWith('o4-mini') ? 1 : undefined,
    system: `You are a helpful assistant
        Tools:
        - searchWeb: A tool for doing web search.
        - generateImage: A tool for generating images using DALL·E 3.
        - arxivApiCaller: A tool for calling arxiv api to search research papers.
        - wikipediaSearch: A tool for searching Wikipedia articles.
        - generateSlides: A tool for generating presentation slides about a topic, This will display the slides in a pptx format in the user interface and user can download the pptx file by clicking on the download button.
    `,
    messages: [
      ...aiState.get().messages.map((message: any) => ({
        role: message.role,
        content: message.content,
        name: message.name
      }))
    ],
    text: ({ content, done, delta }) => {
      if (!textStream) {
        textStream = createStreamableValue('')
        textNode = <BotMessage content={textStream.value} />
      }

      if (done) {
        textStream.done()
        aiState.done({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: 'assistant',
              content
            }
          ]
        })
      } else {
        textStream.update(delta)
      }

      return textNode
    },
    tools: {
      searchWeb: {
        description: 'A tool for doing web search.',
        parameters: z.object({
          query: z.string().describe('The query to be included in the web search based on the user query and content to be searched')
        }),
        generate: async function* ({ query }) {

          let concisedQuery = '';
          try {
            const { text, finishReason, usage } = await generateText({
              system: 'You will receive the query, identify its primary context, and generate a concise and precise query that captures the main intent. For example, if the input query is get the latest AI news, the model should output latest AI news.',
              model: openai('gpt-3.5-turbo'),
              prompt: query,
            });
            concisedQuery = text;
          } catch (error) {
            console.error("An error occurred:", error);
          }

          yield <ToolCallLoading concisedQuery={concisedQuery} />
          await sleep(1000);
          const toolCallId = nanoid();
          const { text, sources } = await executeWebSearch(concisedQuery)

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'assistant',
                content: [
                  {
                    type: 'tool-call',
                    toolName: 'searchWeb',
                    toolCallId,
                    args: { query }
                  }
                ]
              },
              {
                id: nanoid(),
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolName: 'searchWeb',
                    toolCallId,
                    result: { text, sources }
                  }
                ]
              }
            ]
          })
          const newResult = await streamUI({
            model: selectedModel,
            initial: <ToolCallLoading concisedQuery={concisedQuery} />,
            system: `You are a helpful assistant, you extract the relevant data from the given data and try to answer precisely, only share links if asked or required`,
            messages: [
              ...aiState.get().messages
            ],
            text: ({ content, done, delta }) => {
              if (!textStream) {
                textStream = createStreamableValue('')
                textNode = <BotMessage content={textStream.value} />
              }

              if (done) {
                textStream.done()
                aiState.done({
                  ...aiState.get(),
                  messages: [
                    ...aiState.get().messages,
                    {
                      id: nanoid(),
                      role: 'assistant',
                      content: [
                        {
                          type: 'text',
                          text: content,
                          toolName: 'searchWeb'
                        }
                      ]
                    }
                  ]
                })
              } else {
                textStream.update(delta)
              }
              return textNode
            }
          })
          return (
            newResult.value
          )
        },
      },
      generateImage: tool({
        description: 'A tool for generating images using DALL·E 3.',
        parameters: z.object({
          prompt: z.string().describe('The prompt for image generation'),
        }),
        generate: async function* ({ prompt }) {
          yield <ToolImageLoading />
          await sleep(1000)
          const toolCallId = nanoid()

          let imageUrl = ''
          try {
            const completion = await openaiOriginal.images.generate({
              prompt,
              model: 'dall-e-3',
            })

            imageUrl = completion?.data?.[0]?.url
          } catch (error) {
            console.error('An error occurred:', error)
          }

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'assistant',
                content: [
                  {
                    type: 'tool-call',
                    toolName: 'generateImage',
                    toolCallId,
                    args: { prompt }
                  }
                ]
              },
              {
                id: nanoid(),
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolName: 'generateImage',
                    toolCallId,
                    result: imageUrl
                  }
                ]
              }
            ]
          })
          return (
            <BotCard>
              <ToolImages imageUrl={imageUrl} />
            </BotCard>
          )
        }
      }),
      arxivApiCaller: tool({
        description: 'A tool for calling arxiv api to search research papers.',
        parameters: z.object({
          query: z.string().describe('The search query to be included in the arXiv URL parameter'),
          time: z.string().describe(`The specific date for which to search results, formatted as a year-month (e.g., 2023-05), or can be empty string if not specified, remember today is ${getFormattedDate()}`)
        }),
        generate: async function* ({ query, time }) {
          yield <ToolLoadingAnimate searchQuery={query + " " + time} >{"Calling the arvix tool "}</ToolLoadingAnimate>
          await sleep(1000);
          const toolCallId = nanoid();
          const result = await fetchArxiv(query, time);

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'assistant',
                content: [
                  {
                    type: 'tool-call',
                    toolName: 'arxivApiCaller',
                    toolCallId,
                    args: { query }
                  }
                ]
              },
              {
                id: nanoid(),
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolName: 'arxivApiCaller',
                    toolCallId,
                    result: result
                  }
                ]
              }
            ]
          })

          // Let's get the text response          
          const newResult = await streamUI({
            model: selectedModel,
            initial: <h1>Extracting data...</h1>,
            system: `You are a helpful assistant, you process the json data and extract the information such as title, published, links, summary`,
            messages: [
              ...aiState.get().messages
            ],
            text: ({ content, done, delta }) => {
              if (!textStream) {
                textStream = createStreamableValue('')
                textNode = <ArxivToolMessage content={textStream.value} query={query + " " + time} />
              }

              if (done) {
                textStream.done()
                aiState.done({
                  ...aiState.get(),
                  messages: [
                    ...aiState.get().messages,
                    {
                      id: nanoid(),
                      role: 'assistant',
                      content: [
                        {
                          type: 'text',
                          text: content,
                          toolName: 'arxivApiCaller',
                          meta: `${query} ${time}`
                        }
                      ]
                    }
                  ]
                })
              } else {
                textStream.update(delta)
              }
              return textNode
            }
          })
          return (
            newResult.value
          )
        },
      }),
      wikipediaSearch: tool({
        description: 'A tool for searching Wikipedia articles.',
        parameters: z.object({
          query: z.string().describe('The search query to look up on Wikipedia')
        }),
        generate: async function* ({ query }) {
          yield <ToolWikipediaLoading query={query} />
          await sleep(1000)
          const toolCallId = nanoid()

          // Fetch Wikipedia data
          const response = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&origin=*`)
          const data = await response.json()

          const searchResults = data.query?.search || []
          const firstResult = searchResults[0]

          let content = ''
          if (firstResult) {
            const pageResponse = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&pageids=${firstResult.pageid}&origin=*`)
            const pageData = await pageResponse.json()
            content = pageData.query?.pages?.[firstResult.pageid]?.extract || 'No content found'
          }

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'assistant',
                content: [
                  {
                    type: 'tool-call',
                    toolName: 'wikipediaSearch',
                    toolCallId,
                    args: { query }
                  }
                ]
              },
              {
                id: nanoid(),
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolName: 'wikipediaSearch',
                    toolCallId,
                    result: { content, query }
                  }
                ]
              }
            ]
          })

          const newResult = await streamUI({
            model: selectedModel,
            initial: <ToolWikipediaLoading query={query} />,
            system: 'You are a helpful assistant that summarizes Wikipedia content in a clear and concise way.',
            messages: [
              ...aiState.get().messages
            ],
            text: ({ content, done, delta }) => {
              if (!textStream) {
                textStream = createStreamableValue('')
                textNode = <WikipediaToolMessage content={textStream.value} query={query} />
              }

              if (done) {
                textStream.done()
                aiState.done({
                  ...aiState.get(),
                  messages: [
                    ...aiState.get().messages,
                    {
                      id: nanoid(),
                      role: 'assistant',
                      content: [
                        {
                          type: 'text',
                          text: content,
                          toolName: 'wikipediaSearch'
                        }
                      ]
                    }
                  ]
                })
              } else {
                textStream.update(delta)
              }
              return textNode
            }
          })
          return newResult.value
        }
      }),
      generateSlides: tool({
        description: 'A tool for generating presentation slides about a topic.',
        parameters: z.object({
          topic: z.string().describe('The topic for the presentation slides'),
          slideCount: z.number().describe('The number of slides to generate (default is 5)')
        }),
        generate: async function* ({ topic, slideCount = 5 }) {
          yield <ToolSlideLoading topic={topic} />
          await sleep(1000);
          const toolCallId = nanoid();

          // Generate slides using our server action
          const slides = await generateSlides(topic, slideCount);

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'assistant',
                content: [
                  {
                    type: 'tool-call',
                    toolName: 'generateSlides',
                    toolCallId,
                    args: { topic, slideCount }
                  }
                ]
              },
              {
                id: nanoid(),
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolName: 'generateSlides',
                    toolCallId,
                    result: { slides, topic }
                  }
                ]
              }
            ]
          });

          const newResult = await streamUI({
            model: selectedModel,
            initial: <ToolSlideLoading topic={topic} />,
            system: 'You are a helpful assistant',
            messages: [
              ...aiState.get().messages
            ],
            text: ({ content, done, delta }) => {
              if (!textStream) {
                textStream = createStreamableValue('');
                textNode = <SlideToolMessage content={textStream.value} slides={slides} />;
              }

              if (done) {
                textStream.done();
                aiState.done({
                  ...aiState.get(),
                  messages: [
                    ...aiState.get().messages,
                    {
                      id: nanoid(),
                      role: 'assistant',
                      content: [
                        {
                          type: 'text',
                          text: content,
                          toolName: 'generateSlides',
                          slides: slides,
                        }
                      ]
                    }
                  ]
                });
              } else {
                textStream.update(delta);
              }
              return textNode;
            }
          });

          return newResult.value;
        }
      }),
      exportToPdf: {
        description: 'A tool for exporting research content to PDF format.',
        parameters: z.object({
          content: z.string().describe('The content to be exported to PDF'),
          title: z.string().optional().describe('The title for the PDF document')
        }),
        generate: async function* ({ content, title = 'Research Document' }) {
          yield (
            <BotCard>
              <ExportPdfButton content={content} title={title} />
            </BotCard>
          )

          await sleep(1000)

          const toolCallId = nanoid()

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'assistant',
                content: [
                  {
                    type: 'tool-call',
                    toolName: 'exportToPdf',
                    toolCallId,
                    args: { content, title }
                  }
                ]
              },
              {
                id: nanoid(),
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolName: 'exportToPdf',
                    toolCallId,
                    result: { content, title },
                  }
                ]
              }
            ]
          })

          return (
            <BotCard>
              <ExportPdfButton content={content} title={title} />
            </BotCard>
          )
        }
      },
      researchAgent: {
        description: 'A tool for doing research on a topic.',
        parameters: z.object({
          topic: z.string().describe('The topic to be researched'),
          additional_context: z.string().optional().describe('Additional context to be used for the research')
        }),
        generate: async function* ({ topic, additional_context = '' }) {
          yield <ResearchAgentLoading topic={topic} />
          await sleep(1000);
          const toolCallId = nanoid();
          const { text, sources } = await researchAgent(topic, additional_context)

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'assistant',
                content: [
                  {
                    type: 'tool-call',
                    toolName: 'researchAgent',
                    toolCallId,
                    args: { topic, additional_context }
                  }
                ]
              },
              {
                id: nanoid(),
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolName: 'researchAgent',
                    toolCallId,
                    result: { text, sources }
                  }
                ]
              }
            ]
          })


          return (
            <BotCard>
              <ResearchAgentMessage content={text} />
            </BotCard>
          )
        },
      },
    },
  });

  return {
    id: nanoid(),
    display: result.value
  }
}

export type AIState = {
  chatId: string
  messages: Message[]
}

export type UIState = {
  id: string
  display: React.ReactNode
}[]

export const AI = createAI<AIState, UIState>({
  actions: { submitUserMessage },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [] },
  onGetUIState: async () => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const aiState = getAIState()

      if (aiState) {
        const uiState = getUIStateFromAIState(aiState)
        return uiState
      }
    } else {
      return
    }
  },
  onSetAIState: async ({ state }) => {
    'use server'

    const session = await auth()
    if (!session || !session.user) {
      return
    }

    const { chatId, messages } = state
    const userId = session.user.id as string
    const path = `/chat/${chatId}`

    if (messages.length === 0) {
      return
    }

    const existingChat = await getChat(chatId, userId)

    let title = existingChat?.title
    if (!title && messages.length > 0) {
      const firstMessage = messages[0]
      if (firstMessage.role === 'user' && Array.isArray(firstMessage.content)) {
        const textContent = firstMessage.content.find(c => c.type === 'text')
        if (textContent && 'text' in textContent) {
          title = textContent.text.substring(0, 100)
        }
      } else if (firstMessage.role === 'assistant') {
        if (typeof firstMessage.content === 'string') {
          title = firstMessage.content.substring(0, 100)
        } else if (
          Array.isArray(firstMessage.content) &&
          firstMessage.content[0]
        ) {
          const content = firstMessage.content[0]
          if ('text' in content) {
            title = content.text.substring(0, 100)
          }
        }
      }
      title = title || 'New Chat'
    }

    const chat: Chat = {
      id: chatId,
      title: title || 'New Chat',
      userId,
      createdAt: existingChat?.createdAt ?? new Date(),
      messages,
      path
    }

    try {
      await saveChat(chat)
    } catch (error) {
      console.error('Error saving chat:', error)
    }
  }
})

export const getUIStateFromAIState = (state: AIState | Chat) => {
  const chatId = 'chatId' in state ? state.chatId : state.id
  return state.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${chatId}-${index}`,
      display: (() => {
        if (message.role === 'tool') {
          return message.content.map(tool => {
            return tool.toolName === 'listStocks' ? (
              <BotCard>
                <Stocks props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'showStockPrice' ? (
              <BotCard>
                <Stock props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'showStockPurchase' ? (
              <BotCard>
                <Purchase props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'exportToPdf' ? (
              <BotCard>
                <ExportPdfButton
                  content={tool.result.content}
                  title={tool.result.title}
                />
              </BotCard>
            ) : tool.toolName === 'researchAgent' ? (
              <BotCard>
                <ResearchAgentMessage content={tool.result.text} />
              </BotCard>
            ) : tool.toolName === 'getEvents' ? (
              <BotCard>
                <Events props={tool.result} />
              </BotCard>
            ) : null
          })
        }
        if (message.role === 'user') {
          if (!Array.isArray(message.content)) {
            return <UserMessage>{message.content}</UserMessage>
          }

          const textParts = message.content.filter(p => p.type === 'text')
          const imageParts = message.content.filter(p => p.type === 'image')
          const fileParts = message.content.filter(p => p.type === 'file')

          return (
            <UserMessage>
              <div className="flex flex-col gap-2">
                {textParts.map((part, idx) => (
                  <p key={`text-${idx}`}>{'text' in part ? part.text : ''}</p>
                ))}
                {imageParts.map((part, idx) => {
                  const imageData = 'image' in part ? part.image : ''
                  return (
                    <img
                      key={`img-${idx}`}
                      src={`data:image/jpeg;base64,${imageData}`}
                      alt="Uploaded"
                      className="max-w-full h-auto rounded-lg"
                    />
                  )
                })}
                {fileParts.map((part, idx) => {
                  if (!('data' in part)) return null
                  const fileName = ('name' in part && part.name)
                    ? part.name
                    : 'document.pdf'
                  const isPdf = 'mimeType' in part && part.mimeType === 'application/pdf'
                  const mimeType = 'mimeType' in part ? part.mimeType : 'application/pdf'

                  // Convert base64 to data URL for viewing
                  const dataUrl = part.data.startsWith('http')
                    ? part.data // If it's already a URL
                    : `data:${mimeType};base64,${part.data}` // If it's base64

                  return (
                    <a
                      key={`file-${idx}`}
                      href={dataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 flex items-center p-3 rounded-xl gap-3 border border-red-200 dark:border-red-800 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <span className="bg-white dark:bg-zinc-800 p-2 rounded-lg flex items-center justify-center text-red-600">
                        <svg
                          height="16"
                          viewBox="0 0 16 16"
                          width="16"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="currentColor"
                        >
                          <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z" />
                          <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z" />
                        </svg>
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {fileName}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {isPdf ? 'PDF Document' : 'Document'} • Click to open
                        </p>
                      </div>
                    </a>
                  )
                })}
              </div>
            </UserMessage>
          )
        }
        if (message.role === 'assistant') {
          if (typeof message.content === 'string') {
            return <BotMessage content={message.content} />
          } else if (Array.isArray(message.content) && message.content[0]) {
            const content = message.content[0]
            if (content.toolName === 'searchWeb') {
              return (
                <BotCard>
                  <ToolMessage
                    content={content.text}
                    toolCallMeta={content.meta}
                  />
                </BotCard>
              )
            }
            if (content.toolName === 'arxivApiCaller') {
              return (
                <BotCard>
                  <ArxivToolMessage
                    content={content.text}
                    query={content.meta}
                  />
                </BotCard>
              )
            }
            if (content.toolName === 'wikipediaSearch') {
              return (
                <BotCard>
                  <WikipediaToolMessage
                    content={content.text}
                    query={content.meta}
                  />
                </BotCard>
              )
            }
            if (content.toolName === 'generateSlides') {
              return (
                <BotCard>
                  <SlideToolMessage
                    content={content.text}
                    slides={content.slides}
                  />
                </BotCard>
              )
            }
          }
        }
        return null
      })()
    }))
}
