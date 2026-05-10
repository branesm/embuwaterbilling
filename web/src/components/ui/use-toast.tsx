import * as React from "react"

type ToastProps = {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

const toast = (props: ToastProps) => {
  // Simple toast implementation using alert for now
  // In production, you'd use a proper toast system
  console.log(`[Toast] ${props.title}: ${props.description}`)
}

export { toast }
