"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icons";

/** The box a question is typed in. Enter asks; shift-enter is a new line. While a turn runs, the button is Stop. */
export function Composer({ onAsk, onStop, pending, placeholder }: { onAsk(question: string): void; onStop(): void; pending: boolean; placeholder: string }) {
  const [text, setText] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);

  // Grows with what is typed, up to the max height the class sets.
  useEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [text]);

  function ask(): void {
    const asked = text.trim();
    if (!asked || pending) return;
    setText("");
    onAsk(asked);
    field.current?.focus();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        ask();
      }}
      className="shrink-0 border-t border-hairline px-[18px] py-3"
    >
      <div className={`flex items-end gap-2 rounded-lg border border-hairline-strong px-3 py-2.5 ${pending ? "bg-sunken/40" : "bg-canvas"}`}>
        <label htmlFor="chat-question" className="sr-only">
          Ask a question
        </label>
        <textarea
          id="chat-question"
          ref={field}
          rows={1}
          value={text}
          disabled={pending}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              ask();
            }
          }}
          placeholder={pending ? "" : placeholder}
          className="max-h-32 min-h-[22px] grow resize-none overflow-y-auto bg-transparent text-strong leading-[22px] text-ink outline-none placeholder:text-ink-faint disabled:cursor-wait"
        />
        {pending ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop"
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border border-hairline-strong bg-canvas hover:bg-active"
          >
            <span aria-hidden="true" className="h-2 w-2 rounded-xs bg-ink" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={text.trim().length === 0}
            aria-label="Ask"
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-ink disabled:bg-active"
          >
            <Icon name="send" size={13} className={text.trim() ? "text-ink-inverse" : "text-ink-faint"} />
          </button>
        )}
      </div>
    </form>
  );
}
