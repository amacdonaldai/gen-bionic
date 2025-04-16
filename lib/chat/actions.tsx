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

import { saveChat } from '@/app/actions'
import { auth } from '@/auth'
import { Events } from '@/components/stocks/events'
import { SpinnerMessage, ToolCallLoading, ToolImageLoading, ToolImages, ToolMessage, UserMessage, ToolLoadingAnimate, ArxivToolMessage, ToolWikipediaLoading, WikipediaToolMessage, SlideToolMessage, ToolSlideLoading } from '@/components/stocks/message'
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

type TextPart = {
  type: 'text'
  text: string
}

type ImagePart = {
  type: 'image'
  image: string
}

type MessageContent = TextPart | ImagePart

type UserMessage = {
  id: string
  role: 'user'
  content: MessageContent[]
}

type AssistantMessage = {
  id: string
  role: 'assistant'
  content: string
}

type SystemMessage = {
  id: string
  role: 'system'
  content: string
}

type Message = UserMessage | AssistantMessage | SystemMessage

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
  if (model.startsWith('gpt')) {
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
  pdfFiles?: { name: string; text: string }[],
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
    pdfFiles.map(val => {
      messageContent.push({
        type: 'text',
        // To ensure that AI reads this text in PDF formate
        text:
          'Treat the below text as pdf. \n' +
          val.text +
          '\n here, this Pdf ends.'
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
    system: `You are a helpful assistant`,
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
            model: model.startsWith('gpt') ? openai(model) : model.startsWith('claude') ? anthropic(model) : model.startsWith("llama") ? perplexity(model) : openai('gpt-4o'),
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
          slideCount: z.number().optional().describe('The number of slides to generate (default is 5)')
        }),
        generate: async function* ({ topic, slideCount = 5 }) {
          yield <ToolSlideLoading topic={topic} />
          await sleep(1000);
          const toolCallId = nanoid();

          // Generate slides using our server action
          const slides = await generateSlides(topic, slideCount);

          console.log(slides);

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
            system: 'You are a helpful assistant that generates presentation slides. Briefly explain the content of the slides you\'ve created.',
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
                          slides
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
      })
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

    if (session && session.user) {
      const { chatId, messages } = state
      const createdAt = new Date()
      const userId = session.user.id as string
      const path = `/chat/${chatId}`
      const firstMessageContent = messages[0].content
      const title = firstMessageContent[0].text.substring(0, 100)
      // const title = 'firstMessageContent.substring(0, 100)'

      const chat: Chat = {
        id: chatId,
        title,
        userId,
        createdAt,
        messages,
        path
      }

      await saveChat(chat)
    } else {
      return
    }
  }
})

export const getUIStateFromAIState = (aiState: Chat) => {
  return aiState.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display:
        message.role === 'tool' ? (
          message.content.map(tool => {
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
            ) : tool.toolName === 'getEvents' ? (
              <BotCard>
                <Events props={tool.result} />
              </BotCard>
            ) : null
          })
        )
          : message.role === 'user' ? (
            <UserMessage>{message?.content[0]?.text as string}</UserMessage>
          )
            : message.role === 'assistant' ? (
              typeof message.content === 'string' ? (
                <BotMessage content={message.content} />
              ) : (
                typeof message.content === 'object' &&
                (message.content[0]?.toolName === 'searchWeb' ? (
                  <BotCard>
                    <ToolMessage content={message.content[0].text} toolCallMeta={message.content[0].meta} />
                  </BotCard>
                ) : message.content[0]?.toolName === 'arxivApiCaller' ? (
                  <BotCard>
                    <ArxivToolMessage content={message?.content[0]?.text} query={message.content[0].meta} />
                  </BotCard>
                ) : message.content[0]?.toolName === 'wikipediaSearch' ? (
                  <BotCard>
                    <WikipediaToolMessage content={message?.content[0]?.text} query={message.content[0].meta} />
                  </BotCard>
                ) : message.content[0]?.toolName === 'generateSlides' ? (
                  <BotCard>
                    <SlideToolMessage content={message?.content[0]?.text} slides={message.content[0].slides} />
                  </BotCard>
                ) : null)
              )
            ) : null
    }))
}
