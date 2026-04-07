"use client"

import * as React from "react"
import { Send, Check, Pencil, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface ChatInputBarProps {
  inputType: 'text' | 'number' | 'cards' | 'yes_no' | 'summary' | string
  options?: string[]
  summaryData?: any
  onSubmit: (value: any) => void
  isLoading?: boolean
}

export const ChatInputBar = ({
  inputType,
  options = [],
  onSubmit,
  isLoading = false,
  summaryData,
}: ChatInputBarProps) => {
  const [inputValue, setInputValue] = React.useState("")

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (inputValue.trim() || inputType === 'number') {
      onSubmit(inputValue)
      setInputValue("")
    }
  }

  const renderInput = () => {
    switch (inputType) {
      case 'text':
      case 'number':
        return (
          <form onSubmit={handleSend} className="flex gap-2 w-full max-w-4xl mx-auto p-4 bg-white/50 backdrop-blur-md rounded-t-xl border-t border-zinc-100">
            <Input
              type={inputType}
              placeholder="Type your answer..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              className="flex-1 rounded-full px-6 border-zinc-200"
            />
            <Button 
              type="submit" 
              size="icon" 
              className="rounded-full h-10 w-10 shrink-0" 
              disabled={isLoading || !inputValue.trim()}
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            </Button>
          </form>
        )

      case 'cards':
      case 'yes_no':
        return (
          <div className="flex flex-wrap gap-3 w-full max-w-4xl mx-auto p-4 justify-center">
            {options.map((option) => (
              <Button
                key={option}
                variant="outline"
                className="rounded-xl px-6 py-5 h-auto text-base hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all active:scale-95 disabled:opacity-50"
                onClick={() => onSubmit(option)}
                disabled={isLoading}
              >
                {option}
              </Button>
            ))}
          </div>
        )

      case 'summary':
        return (
          <div className="w-full max-w-4xl mx-auto p-4 flex flex-col gap-4">
            {summaryData && (
              <Card className="border-0 shadow-sm bg-zinc-50">
                <CardContent className="p-4">
                  <div className="text-sm text-zinc-600">Please review your summary below:</div>
                  <pre className="mt-2 text-xs text-zinc-800 whitespace-pre-wrap">{JSON.stringify(summaryData, null, 2)}</pre>
                </CardContent>
              </Card>
            )}
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                className="flex-1 max-w-[200px] border-zinc-200 gap-2"
                onClick={() => onSubmit("edit")}
                disabled={isLoading}
              >
                <Pencil size={18} />
                Edit
              </Button>
              <Button
                className="flex-1 max-w-[200px] gap-2"
                onClick={() => onSubmit("confirm")}
                disabled={isLoading}
              >
                <Check size={18} />
                Confirm
              </Button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="w-full border-t border-zinc-100 bg-white/80 backdrop-blur-sm sticky bottom-0 z-10 min-h-[80px] flex items-center">
      {renderInput()}
      {isLoading && inputType !== 'text' && inputType !== 'number' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-[1px]">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      )}
    </div>
  )
}
