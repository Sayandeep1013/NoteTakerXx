"use client";

import { useState } from "react";
import { useNotesStore } from "@/store/notes";
import upiQr from "../../images/upi qr.jpeg";
import Modal from "./ui/Modal";
import { CoffeeIcon } from "./ui/icons";

export default function CoffeeButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="fab" onClick={() => setOpen(true)} title="Buy me a coffee" aria-label="Buy me a coffee">
        <CoffeeIcon size={20} />
      </button>
      {open && (
        <Modal variant="paper" label="Buy me a coffee" onClose={() => setOpen(false)} closeButton style={{ width: "min(340px, 100%)", textAlign: "center" }}>
          <h2 className="modal-title">Buy me a coffee</h2>
          <p className="modal-body" style={{ marginBottom: 14 }}>Scan with any UPI app. Thank you!</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={upiQr.src}
            alt="UPI QR code"
            width={220}
            height={220}
            style={{ display: "block", margin: "0 auto 18px", borderRadius: 12, background: "#fff", objectFit: "contain", boxShadow: "var(--shadow-sm)" }}
          />
          <div className="panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 12.5 }}>Hide this button?</span>
            <button className="btn" style={{ height: 30 }} onClick={() => { useNotesStore.getState().setCoffeeVisible(false); setOpen(false); }}>Hide</button>
          </div>
        </Modal>
      )}
    </>
  );
}
