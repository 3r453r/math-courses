"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { tryExpandSlashCommand, detectPendingSlash } from "@/lib/scratchpad/expandSlashCommand";
import { filterCommandsByPrefix } from "@/lib/scratchpad/slashCommands";
import type { SlashCommand } from "@/lib/scratchpad/slashCommands";
import { SlashCommandPopup } from "./SlashCommandPopup";

export interface ScratchpadEditorHandle {
  insertAtCursor: (text: string, cursorOffset: number) => void;
}

interface ScratchpadEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  className?: string;
}

export const ScratchpadEditor = forwardRef<ScratchpadEditorHandle, ScratchpadEditorProps>(
  function ScratchpadEditor({ value, onChange, onSave, className }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [popupCommands, setPopupCommands] = useState<SlashCommand[]>([]);
    const [popupVisible, setPopupVisible] = useState(false);
    const [popupIndex, setPopupIndex] = useState(0);
    const [slashInfo, setSlashInfo] = useState<{ slashIndex: number; query: string } | null>(null);

    // Expose insertAtCursor for symbol picker
    useImperativeHandle(ref, () => ({
      insertAtCursor(text: string, cursorOffset: number) {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = value.substring(0, start);
        const after = value.substring(end);
        const newText = before + text + after;
        onChange(newText);
        const cursorPos = before.length + text.length - cursorOffset;
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(cursorPos, cursorPos);
            textareaRef.current.focus();
          }
        });
      },
    }));

    // Detect pending slash on content/cursor changes
    const updateSlashDetection = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        setPopupVisible(false);
        return;
      }
      const pending = detectPendingSlash(textarea.value, textarea.selectionStart);
      if (pending) {
        setSlashInfo(pending);
        const matches = filterCommandsByPrefix(pending.query, 8);
        setPopupCommands(matches);
        setPopupVisible(matches.length > 0);
        setPopupIndex(0);
      } else {
        setPopupVisible(false);
        setSlashInfo(null);
      }
    }, []);

    // Apply a slash command expansion from popup selection
    const applyCommand = useCallback(
      (cmd: SlashCommand) => {
        if (!slashInfo || !textareaRef.current) return;
        const before = value.substring(0, slashInfo.slashIndex);
        const after = value.substring(slashInfo.slashIndex + 1 + slashInfo.query.length);
        const newText = before + cmd.expansion + after;
        onChange(newText);
        const cursorPos = before.length + cmd.expansion.length - cmd.cursorOffset;
        setPopupVisible(false);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(cursorPos, cursorPos);
            textareaRef.current.focus();
          }
        });
      },
      [value, onChange, slashInfo]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Ctrl+S / Cmd+S: manual save
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
          e.preventDefault();
          onSave();
          return;
        }

        // When popup is visible, handle navigation keys
        if (popupVisible && popupCommands.length > 0) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setPopupIndex((prev) => (prev + 1) % popupCommands.length);
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setPopupIndex((prev) => (prev - 1 + popupCommands.length) % popupCommands.length);
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            applyCommand(popupCommands[popupIndex]);
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setPopupVisible(false);
            return;
          }
        }

        // Tab: always prevent default (no focus leave). Try expansion, else insert soft tab.
        if (e.key === "Tab") {
          e.preventDefault();
          const textarea = e.currentTarget;
          const result = tryExpandSlashCommand(textarea.value, textarea.selectionStart);

          if (result) {
            onChange(result.newText);
            setPopupVisible(false);
            requestAnimationFrame(() => {
              if (textareaRef.current) {
                textareaRef.current.setSelectionRange(
                  result.newCursorPosition,
                  result.newCursorPosition
                );
              }
            });
          } else {
            // Insert 2 spaces (soft tab)
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const before = textarea.value.substring(0, start);
            const after = textarea.value.substring(end);
            onChange(before + "  " + after);
            requestAnimationFrame(() => {
              if (textareaRef.current) {
                textareaRef.current.setSelectionRange(start + 2, start + 2);
              }
            });
          }
          return;
        }

        // Space: attempt slash-command expansion
        if (e.key === " ") {
          const textarea = e.currentTarget;
          const result = tryExpandSlashCommand(textarea.value, textarea.selectionStart);
          if (result) {
            e.preventDefault();
            onChange(result.newText);
            setPopupVisible(false);
            requestAnimationFrame(() => {
              if (textareaRef.current) {
                textareaRef.current.setSelectionRange(
                  result.newCursorPosition,
                  result.newCursorPosition
                );
              }
            });
          }
          // If no expansion, let Space proceed normally
        }
      },
      [onChange, onSave, popupVisible, popupCommands, popupIndex, applyCommand]
    );

    // Update slash detection after every change and click
    useEffect(() => {
      const timer = setTimeout(updateSlashDetection, 10);
      return () => clearTimeout(timer);
    }, [value, updateSlashDetection]);

    return (
      <div className={`relative flex-1 min-h-0 flex flex-col ${className ?? ""}`}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onClick={updateSlashDetection}
          className="w-full flex-1 min-h-0 resize-none bg-background text-foreground font-mono text-sm p-4 outline-none placeholder:text-muted-foreground"
          placeholder={`Start typing your notes here...\n\nUse LaTeX: $x^2$ for inline math, $$\\sum_{i=1}^n$$ for display math\n\nType / to see available slash commands\nPress Ctrl+S to save`}
          spellCheck={false}
        />
        <SlashCommandPopup
          commands={popupCommands}
          selectedIndex={popupIndex}
          onSelect={applyCommand}
          visible={popupVisible}
        />
      </div>
    );
  }
);
