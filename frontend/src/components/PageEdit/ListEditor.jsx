/**
 * ListEditor — editing for a hub page's saved lists (page_content through
 * usePageData). Culture and Society read their lists' saved edits but had
 * no way to make one: Culture took only { data, saving, loaded } from
 * usePageData, and Society mounted an EditItemModal nothing ever opened,
 * whose save would have written every list, Culture's calendar lists
 * included, into influencer_systems (wiring map,
 * docs/reads/2026-10-06-lalaverse-wiring-map.md, fix-list item 21).
 *
 * useListEditor(pages) takes the page's usePageData results by page name
 * and gives:
 *   editing, setEditing  whether the lists show their controls
 *   edit(page, key, index, item, what)   open the item in EditItemModal
 *   add(page, key, items, what)          open a blank item shaped like the list's first
 *   remove(page, key, index, name)       remove it, after a confirm
 *   modal                the open EditItemModal, or null; its Save writes
 *                        to the page that owns the list
 *
 * EditListsToggle, ItemActions and AddToList are the controls, in the
 * hub's design (ListEditor.css, tokens only).
 */
import React, { useState } from 'react';
import { EditItemModal } from '../EditItemModal';
import './ListEditor.css';

/** A blank item shaped like the list's first: text empty, lists empty, numbers 0. */
export function blankLike(items) {
  const first = (items || [])[0];
  if (!first || typeof first !== 'object') return { name: '' };
  return Object.fromEntries(Object.entries(first).map(([k, v]) => [k,
    Array.isArray(v) ? []
      : typeof v === 'number' ? 0
        : typeof v === 'boolean' ? false
          : v && typeof v === 'object' ? {}
            : '']));
}

export default function useListEditor(pages) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(null);

  const edit = (page, key, index, item, what) => setOpen({ page, key, index, item, what });
  const add = (page, key, items, what) => setOpen({ page, key, index: -1, item: blankLike(items), what });
  const remove = (page, key, index, name) => {
    if (!window.confirm(`Remove “${name || 'this item'}”? The saved list changes for everyone.`)) return;
    pages[page].removeItem(key, index);
  };

  const modal = open ? (
    <EditItemModal
      item={open.item}
      title={`${open.index === -1 ? 'Add' : 'Edit'} ${open.what}`}
      onSave={(updated) => {
        const owner = pages[open.page];
        if (open.index === -1) owner.addItem(open.key, updated);
        else owner.updateItem(open.key, open.index, updated);
        setOpen(null);
      }}
      onCancel={() => setOpen(null)}
    />
  ) : null;

  return { editing, setEditing, edit, add, remove, modal };
}

/** The page header's switch between reading and editing the lists. */
export function EditListsToggle({ editing, onToggle }) {
  return (
    <button type="button" className={`le-toggle${editing ? ' is-on' : ''}`} aria-pressed={editing} onClick={onToggle}>
      {editing ? 'Done editing' : 'Edit lists'}
    </button>
  );
}

/** An item's Edit and Remove, shown while the lists are being edited. */
export function ItemActions({ name, onEdit, onRemove }) {
  return (
    <span className="le-actions">
      <button type="button" className="le-btn" onClick={onEdit} aria-label={`Edit ${name}`}>Edit</button>
      <button type="button" className="le-btn is-remove" onClick={onRemove} aria-label={`Remove ${name}`}>Remove</button>
    </span>
  );
}

/** The list's own "+ Add", shown while the lists are being edited. */
export function AddToList({ what, onAdd }) {
  return <button type="button" className="le-add" onClick={onAdd}>+ Add {what}</button>;
}
