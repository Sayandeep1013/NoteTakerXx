"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { randomNoteColor, noteColorVar, type NoteColor } from "@/lib/colors";
import { CloseIcon } from "./icons";

// Open dialogs, newest last: Escape only closes the top-most one.
const openStack: object[] = [];

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  /** "paper" renders a taped sticky-note card; "surface" a plain theme panel. */
  variant?: "paper" | "surface";
  /** Fixed paper colour; a random one is picked when omitted. */
  paperColor?: NoteColor;
  className?: string;
  style?: React.CSSProperties;
  label: string;
  top?: boolean;
  closeButton?: boolean;
}

export default function Modal({ onClose, children, variant = "surface", paperColor, className = "", style, label, top, closeButton }: ModalProps) {
  const [color] = useState<NoteColor>(() => paperColor ?? randomNoteColor());
  const cardRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const token = {};
    openStack.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || openStack[openStack.length - 1] !== token) return;
      e.stopImmediatePropagation();
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    // Move focus into the dialog unless something inside already took it (autoFocus).
    const card = cardRef.current;
    if (card && !card.contains(document.activeElement)) {
      (card.querySelector<HTMLElement>("[data-autofocus], input, textarea, button.btn--primary") ?? card).focus({ preventScroll: true });
    }
    return () => {
      window.removeEventListener("keydown", onKey, true);
      openStack.splice(openStack.indexOf(token), 1);
    };
  }, []);

  const paperStyle = variant === "paper" ? ({ "--paper": noteColorVar(color) } as React.CSSProperties) : undefined;

  return createPortal(
    <div className={`modal-backdrop${top ? " modal-backdrop--top" : ""}`} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`modal ${variant === "paper" ? "paper-card ruled" : "surface modal--surface"} ${className}`}
        style={{ ...paperStyle, ...style }}
      >
        {variant === "paper" && <div className="tape" />}
        {closeButton && (
          <button className="icon-btn icon-btn--sm icon-btn--round modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon size={16} />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmProps {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  variant?: "paper" | "surface";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, cancelLabel = "Cancel", danger, variant = "paper", onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal onClose={onCancel} variant={variant} label={title}>
      <h2 className="modal-title">{title}</h2>
      <p className="modal-body">{message}</p>
      <div className="modal-actions">
        <button className="btn" onClick={onCancel}>{cancelLabel}</button>
        <button className={`btn ${danger ? "btn--danger" : "btn--primary"}`} data-autofocus onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
