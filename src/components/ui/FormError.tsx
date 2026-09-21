import { CircleAlert } from "lucide-react";

interface FormErrorProps {
  message: string | null;
}

export default function FormError({ message }: FormErrorProps) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
