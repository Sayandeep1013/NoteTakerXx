"use client";

import { useAuth } from "@/hooks/useAuth";
import { useNoteSync } from "@/hooks/useNoteSync";
import { useConnectionSync } from "@/hooks/useConnectionSync";
import Modal from "./ui/Modal";

/** Runs local/cloud sync and shows its prompts. Kept apart from the UI so sync never re-renders the toolbar. */
export default function SyncManager() {
  const { user, loading } = useAuth();
  const { showMergePrompt, cachedCount, mergeLocalToCloud, discardLocal, dbError } = useNoteSync(user, loading);
  useConnectionSync(user, !loading);

  return (
    <>
      {dbError && (
        <div className="hud top-right">
          <div className="surface toast toast--error" role="alert">{dbError}</div>
        </div>
      )}
      {showMergePrompt && (
        // Not dismissible by Esc/backdrop: "Discard" deletes local data, so it must be a deliberate click.
        <Modal label="Keep items from this browser?" onClose={() => {}}>
          <h2 className="modal-title">Keep {cachedCount} {cachedCount === 1 ? "item" : "items"} from this browser?</h2>
          <p className="modal-body">You made these before signing in. Save them to your account so they sync everywhere, or discard them.</p>
          <div className="modal-actions">
            <button className="btn btn--danger-ghost" onClick={discardLocal}>Discard</button>
            <button className="btn btn--primary" data-autofocus onClick={() => void mergeLocalToCloud()}>Save to account</button>
          </div>
        </Modal>
      )}
    </>
  );
}
