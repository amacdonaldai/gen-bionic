'use client'
import { useModel } from '@/app/context/ModelContext'
import { Faq } from '@/components/faq'
import { Button } from '@/components/ui/button'
import {
  IconArrowElbow,
  IconPlus,
  IconTrash,
  IconsDocument,
  IconSpinner
} from '@/components/ui/icons'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { type AI } from '@/lib/chat/actions'
import { useEnterSubmit } from '@/lib/hooks/use-enter-submit'
import { useActions, useUIState } from 'ai/rsc'
import axios from 'axios'
import imageCompression from 'browser-image-compression'
import { nanoid } from 'nanoid'
import * as React from 'react'
import Textarea from 'react-textarea-autosize'
import { toast } from 'sonner'
import { BotMessage, UserMessage } from './stocks/message'
import { Session } from '@/lib/types'

export function PromptForm({
  input,
  setInput,
  session
}: {
  input: string
  setInput: (value: string) => void
  session?: Session
}) {
  console.log(session)
  const { formRef, onKeyDown } = useEnterSubmit()
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const { submitUserMessage } = useActions()
  const [messages, setMessages] = useUIState<typeof AI>()
  const [uploadedImages, setUploadedImages] = React.useState<
    { name: string; data: string }[]
  >([])

  //Adding Pdf files
  const [uploadedPdfFiles, setUploadedPdfFiles] = React.useState<
    {
      base64: string
      name: string
      mimeType: string
    }[]
  >([])

  const [uploadingCSVFiles, setUploadingCSVFiles] = React.useState<
    { name: string; text: string }[]
  >([])

  const [isUploading, setIsUploading] = React.useState(false)

  const { model } = useModel()

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const fileRef = React.useRef<HTMLInputElement>(null)

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!event.target.files) {
      toast.error('No file selected')
      return
    }

    const files = Array.from(event.target.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))

    //For checking Pdf files
    const pdfFiles = files.filter(file =>
      file.type.startsWith('application/pdf')
    )

    //For checking csv files
    const csvFiles = files.filter(file => file.type.startsWith('text/csv'))

    // Checking for pdf and images
    if (
      imageFiles.length <= 0 &&
      pdfFiles.length <= 0 &&
      csvFiles.length <= 0
    ) {
      return toast.error('Only CSV, Pdf and Images are allowed.')
    }

    setIsUploading(true)

    if (imageFiles.length > 0) {
      for (const file of imageFiles) {
        try {
          // Compress the image before encoding it
          const compressedFile = await compressImage(file)

          // Wrap FileReader in a Promise to properly await it
          const base64String = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onerror = () => {
              reject(new Error('Failed to read file'))
            }
            reader.onloadend = () => {
              const result = reader.result as string
              if (!result) {
                reject(new Error('Failed to encode file'))
              } else {
                resolve(result)
              }
            }
            reader.readAsDataURL(compressedFile)
          })

          setUploadedImages(prevImages => [
            ...prevImages,
            { name: file.name, data: base64String }
          ])
        } catch (error) {
          toast.error(`Failed to process ${file.name}`)
          console.error('Error processing image:', error)
        }
      }
    }
    if (pdfFiles.length > 0) {
      for (const file of pdfFiles) {
        const fileName = file.name
        try {
          // Method: Convert PDF to base64 (most reliable, no external dependencies)
          const base64String = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onerror = () => reject(new Error('Failed to read file'))
            reader.onloadend = () => {
              const result = reader.result as string
              if (!result) {
                reject(new Error('Failed to encode file'))
              } else {
                // Remove data URL prefix if present
                const base64 = result.split(',')[1] || result
                resolve(base64)
              }
            }
            reader.readAsDataURL(file)
          })

          setUploadedPdfFiles(prev => [
            ...prev,
            {
              base64: base64String,
              name: fileName,
              mimeType: file.type
            }
          ])

          // COMMENTED: Vercel Blob Upload Method
          // const formData = new FormData()
          // formData.append('file', file)
          // const res = await axios.post('/api/upload-blob', formData, {
          //   headers: { 'Content-Type': 'multipart/form-data' }
          // })
          // if (res.data?.url) {
          //   setUploadedPdfFiles(prev => [...prev, {
          //     url: res.data.url,
          //     name: fileName,
          //     mimeType: file.type
          //   }])
          // }

        } catch (error) {
          console.error('Error processing PDF file:', error)
          toast.error(`Error processing ${fileName}`)
        }
      }
    }

    if (csvFiles && csvFiles.length > 0) {
      for (const file of csvFiles) {
        const fileName = file.name
        const formData = new FormData()
        formData.append('csv', file)

        try {
          const res = await axios.post('/api/upload/csv-to-text', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          })
          if (res.data?.text) {
            setUploadingCSVFiles(prev => [
              ...prev,
              { name: fileName, text: res.data.text }
            ])
          }
        } catch (error) {
          toast.error('Error uploading csv file.')
        }
      }
    }
    setIsUploading(false)

    // Clear the file input so the same file can be selected again
    if (fileRef.current) {
      fileRef.current.value = ''
    }
  }

  const compressImage = async (file: File) => {
    const options = {
      maxSizeMB: 0.5, // Compress to a smaller size if necessary
      maxWidthOrHeight: 1920,
      useWebWorker: true
    }

    try {
      const compressedFile = await imageCompression(file, options)
      return compressedFile
    } catch (error) {
      console.error('Error compressing the image:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!session) return toast.error('You need to login first')
    if (window.innerWidth < 600) {
      e.currentTarget['message']?.blur()
    }

    const value = input.trim()
    setInput('')
    if (!value && uploadedImages.length === 0) return

    const combinedContent = (
      <div className="flex flex-col gap-2">
        <p>{value}</p>
        {uploadedImages.map((image, index) => (
          <img
            key={index}
            src={image.data}
            alt="Uploaded"
            className="max-w-full h-auto rounded-lg"
          />
        ))}
        {uploadedPdfFiles.map((val, index) => {
          return (
            <div
              key={index}
              className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950 flex items-center p-3 rounded-xl gap-3 border border-red-200 dark:border-red-800"
            >
              <span className="bg-white dark:bg-zinc-800 p-2 rounded-lg flex items-center justify-center text-red-600">
                <IconsDocument />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{val.name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">PDF Document</p>
              </div>
            </div>
          )
        })}
        {uploadingCSVFiles.map((val, index) => {
          return (
            <div
              key={index}
              className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 flex items-center p-3 rounded-xl gap-3 border border-green-200 dark:border-green-800"
            >
              <span className="bg-white dark:bg-zinc-800 p-2 rounded-lg flex items-center justify-center text-green-600">
                <IconsDocument />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{val.name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">CSV Document</p>
              </div>
            </div>
          )
        })}
      </div>
    )

    setMessages(currentMessages => [
      ...currentMessages,
      {
        id: nanoid(),
        display: <UserMessage>{combinedContent}</UserMessage>
      }
    ])

    try {
      // Extract just the base64 data for submission
      const imageDataArray = uploadedImages.map(img => img.data)

      const responseMessage = await submitUserMessage(
        value,
        model,
        imageDataArray,
        uploadedPdfFiles,
        uploadingCSVFiles
      )
      setMessages(currentMessages => [...currentMessages, responseMessage])
      console.log(uploadingCSVFiles)
      setUploadedImages([])
      setUploadedPdfFiles([])
      setUploadingCSVFiles([])

      // Clear the file input
      if (fileRef.current) {
        fileRef.current.value = ''
      }
    } catch (error) {
      console.error('Error submitting message:', error)
      toast(
        <div className="text-red-600">
          Something went wrong! Please try again.
        </div>
      )
    }
  }

  const canUploadAttachments = [
    'gpt-4',
    'gpt-4-turbo',
    'gpt-4o-2024-05-13',
    'gpt-4o-mini',
    'gpt-4.1-mini',
  ].includes(model)

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <input
        type="file"
        className="hidden"
        id="file"
        ref={fileRef}
        // accept="images/*"
        onChange={handleFileChange}
        multiple
      />

      {/* File Preview Section - Outside Input Box */}
      {(uploadedImages.length > 0 || uploadedPdfFiles.length > 0 || uploadingCSVFiles.length > 0 || isUploading) && (
        <div className="mb-3 px-2">
          <div className="flex flex-wrap gap-2">
            {/* Image Previews */}
            {uploadedImages.map((image, index) => (
              <div
                key={`img-${index}`}
                className="relative group bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-2 flex items-center gap-2 min-w-[200px] max-w-[250px] shadow-sm hover:shadow-md transition-all"
              >
                <img
                  src={image.data}
                  alt="Preview"
                  className="w-12 h-12 rounded object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate" title={image.name}>
                    {image.name}
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    Image file
                  </p>
                </div>
                <button
                  type="button"
                  className="flex-shrink-0 text-zinc-400 hover:text-red-500 transition-colors"
                  onClick={() =>
                    setUploadedImages(prevImages =>
                      prevImages.filter((_, i) => i !== index)
                    )
                  }
                >
                  <IconTrash className="w-4 h-4" />
                  <span className="sr-only">Remove</span>
                </button>
              </div>
            ))}

            {/* PDF Previews */}
            {uploadedPdfFiles.map((pdf, index) => (
              <div
                key={`pdf-${index}`}
                className="relative group bg-white dark:bg-zinc-800 rounded-lg border border-red-200 dark:border-red-800 p-2 flex items-center gap-2 min-w-[200px] max-w-[250px] shadow-sm hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white flex-shrink-0">
                  <div className="scale-150">
                    <IconsDocument />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate" title={pdf.name}>
                    {pdf.name}
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    PDF Document
                  </p>
                </div>
                <button
                  type="button"
                  className="flex-shrink-0 text-zinc-400 hover:text-red-500 transition-colors"
                  onClick={() =>
                    setUploadedPdfFiles(prevFiles =>
                      prevFiles.filter((_, i) => i !== index)
                    )
                  }
                >
                  <IconTrash className="w-4 h-4" />
                  <span className="sr-only">Remove</span>
                </button>
              </div>
            ))}

            {/* CSV Previews */}
            {uploadingCSVFiles.map((csv, index) => (
              <div
                key={`csv-${index}`}
                className="relative group bg-white dark:bg-zinc-800 rounded-lg border border-green-200 dark:border-green-800 p-2 flex items-center gap-2 min-w-[200px] max-w-[250px] shadow-sm hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white flex-shrink-0">
                  <div className="scale-150">
                    <IconsDocument />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate" title={csv.name}>
                    {csv.name}
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    CSV Document
                  </p>
                </div>
                <button
                  type="button"
                  className="flex-shrink-0 text-zinc-400 hover:text-green-600 transition-colors"
                  onClick={() =>
                    setUploadingCSVFiles(prevFiles =>
                      prevFiles.filter((_, i) => i !== index)
                    )
                  }
                >
                  <IconTrash className="w-4 h-4" />
                  <span className="sr-only">Remove</span>
                </button>
              </div>
            ))}

            {/* Uploading Indicator */}
            {isUploading && (
              <div className="bg-white dark:bg-zinc-800 rounded-lg border border-blue-200 dark:border-blue-800 p-2 flex items-center gap-2 min-w-[200px] shadow-sm">
                <div className="w-12 h-12 rounded bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white flex-shrink-0">
                  <IconSpinner className="w-5 h-5 animate-spin" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                    Uploading...
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    Please wait
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input Box */}
      <div className="relative flex w-full items-center bg-zinc-100 px-6 sm:rounded-full sm:px-6">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 rounded-full bg-background p-0 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  if (isUploading || !canUploadAttachments) {
                    return
                  }
                  fileRef.current?.click()
                }}
                disabled={isUploading || !canUploadAttachments}
              >
                {isUploading ? (
                  <IconSpinner className="animate-spin" />
                ) : (
                  <IconPlus />
                )}
                <span className="sr-only">
                  {isUploading ? 'Uploading...' : canUploadAttachments ? 'Add Attachments' : 'Attachments not supported'}
                </span>
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {isUploading
              ? 'Uploading files...'
              : !canUploadAttachments
                ? 'This model does not support file attachments. Please select GPT-4, GPT-4 Turbo, GPT-4o, or GPT-4o Mini.'
                : 'Add Attachments'}
          </TooltipContent>
        </Tooltip>
        <Textarea
          ref={inputRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          placeholder="Message Bionic Diamond"
          className="flex-1 min-h-[60px] bg-transparent placeholder:text-zinc-900 resize-none px-4 py-[1.3rem] focus-within:outline-none sm:text-sm"
          autoFocus
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          name="message"
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="submit"
              size="icon"
              disabled={
                isUploading ||
                (input === '' && uploadedImages.length === 0 && uploadedPdfFiles.length === 0 && uploadingCSVFiles.length === 0)
              }
              className="bg-black shadow-none hover:bg-gray-800 rounded-full disabled:opacity-50"
              style={{ background: "black" }}
            >
              <IconArrowElbow />
              <span className="sr-only">Send message</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isUploading ? 'Wait for upload to complete...' : 'Send message'}
          </TooltipContent>
        </Tooltip>
      </div>

      <p className="text-xs text-gray-300 ml-4 transition-opacity duration-300 ease-in-out text-center mt-2">
        {'Models may make mistakes, always validate your work'}
      </p>
      <p className="text-xs text-gray-300 ml-4 transition-opacity duration-300 ease-in-out text-center">
        {['gemma-7b-it', 'mixtral-8x7b-32768'].includes(model)
          ? '❗Prone to rate limits'
          : ''}
      </p>
      <div className="flex justify-end max-w-5xl mx-auto">
        <Faq />
      </div>
    </form>
  )
}
