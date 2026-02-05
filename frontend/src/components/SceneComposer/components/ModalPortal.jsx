import { createPortal } from "react-dom";

/**
 * ModalPortal Component
 * 
 * Renders children into the #modal-root element using React portals.
 * This ensures all modals are rendered above canvas elements and other content.
 * 
 * Usage:
 *   <ModalPortal>
 *     <YourModal />
 *   </ModalPortal>
 * 
 * Requirements:
 *   - #modal-root element must exist in the DOM (usually in index.html)
 *   - #modal-root should have:
 *     position: fixed;
 *     z-index: 999999999;
 *     pointer-events: none;
 *   - #modal-root > * should have:
 *     pointer-events: auto;
 */
export default function ModalPortal({ children }) {
  const root = document.getElementById("modal-root");
  if (!root) {
    console.warn("ModalPortal: #modal-root element not found in DOM");
    return null;
  }
  return createPortal(children, root);
}

