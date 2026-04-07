"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Bot, User } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatBubbleProps {
  sender: 'bot' | 'user'
  children: React.ReactNode
}

export const ChatBubble = ({ sender, children }: ChatBubbleProps) => {
  const isBot = sender === 'bot'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={cn(
        "flex w-full mb-4 items-end gap-2",
        isBot ? "justify-start" : "justify-end flex-row-reverse"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full border shadow",
          isBot ? "bg-zinc-100 text-zinc-600" : "bg-blue-600 text-white"
        )}
      >
        {isBot ? <Bot size={18} /> : <User size={18} />}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
          isBot
            ? "bg-zinc-100 text-zinc-900 rounded-bl-none border border-zinc-200"
            : "bg-blue-600 text-white rounded-br-none"
        )}
      >
        {children}
      </div>
    </motion.div>
  )
}
