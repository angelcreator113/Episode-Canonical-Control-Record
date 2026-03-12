import React, { useState, useEffect, useContext, createContext } from 'react';
import './EditItemModal.css';

/**
 * PageEditContext — shared across a page's sub-components.
 */
export const PageEditContext = createContext({
  data: {},
  editMode: false,
  setEditItem: () => {},
  removeItem: () => {},
});

export function usePageEdit() {
  return useContext(PageEditContext);
}

/**
 * EditableList — replaces CONSTANT.map() with editable item rendering.
 * Usage:
 *   <EditableList constantKey="CELEBRITY_HIERARCHY" defaults={CELEBRITY_HIERARCHY} label="Add Tier">
 *     {(item, idx) => <div>...existing card JSX...</div>}
 *   </EditableList>
 */
export function EditableList({ constantKey, defaults, children, label }) {
  const { data, setEditItem, removeItem } = usePageEdit();
  const items = data[constantKey] || defaults;

  return (
    <>
      {items.map((item, idx) => (
        <EditOverlay
          key={idx}
          onEdit={() => setEditItem({ key: constantKey, index: idx, item })}
          onDelete={() => removeItem(constantKey, idx)}
        >
          {children(item, idx)}
        </EditOverlay>
      ))}
      <AddItemButton
        onClick={() => {
          const template = items[0]
            ? Object.fromEntries(Object.keys(items[0]).map(k => [k, Array.isArray(items[0][k]) ? [] : '']))
            : {};
          setEditItem({ key: constantKey, index: -1, item: template });
        }}
        label={label || 'Add Item'}
      />
    </>
  );
}

/**
 * Auto-generates form fields from an object's properties.
 * String → textarea/input, Number → number input, Boolean → checkbox,
 * Array → comma-separated input, Object → JSON textarea.
 */
export function EditItemModal({ item, onSave, onCancel, title }) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    setFormData(item ? { ...item } : {});
  }, [item]);

  if (!item) return null;

  const handleChange = (key, value, type) => {
    let parsed = value;
    if (type === 'number') parsed = value === '' ? '' : Number(value);
    else if (type === 'boolean') parsed = value;
    else if (type === 'array') parsed = value.split(',').map(s => s.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, [key]: parsed }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const fields = Object.entries(item);

  return (
    <div className="eim-overlay" onClick={onCancel}>
      <div className="eim-modal" onClick={e => e.stopPropagation()}>
        <div className="eim-header">
          <h3>{title || 'Edit Item'}</h3>
          <button className="eim-close" onClick={onCancel}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="eim-form">
          {fields.map(([key, val]) => {
            const type = Array.isArray(val) ? 'array'
              : typeof val === 'boolean' ? 'boolean'
              : typeof val === 'number' ? 'number'
              : (typeof val === 'object' && val !== null) ? 'json'
              : 'string';

            return (
              <div className="eim-field" key={key}>
                <label className="eim-label">{key.replace(/_/g, ' ')}</label>
                {type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={!!formData[key]}
                    onChange={e => handleChange(key, e.target.checked, 'boolean')}
                  />
                ) : type === 'number' ? (
                  <input
                    type="number"
                    className="eim-input"
                    value={formData[key] ?? ''}
                    onChange={e => handleChange(key, e.target.value, 'number')}
                  />
                ) : type === 'array' ? (
                  <input
                    type="text"
                    className="eim-input"
                    value={Array.isArray(formData[key]) ? formData[key].join(', ') : ''}
                    onChange={e => handleChange(key, e.target.value, 'array')}
                    placeholder="comma-separated values"
                  />
                ) : type === 'json' ? (
                  <textarea
                    className="eim-textarea"
                    rows={4}
                    value={typeof formData[key] === 'string' ? formData[key] : JSON.stringify(formData[key], null, 2)}
                    onChange={e => {
                      try {
                        setFormData(prev => ({ ...prev, [key]: JSON.parse(e.target.value) }));
                      } catch {
                        setFormData(prev => ({ ...prev, [key]: e.target.value }));
                      }
                    }}
                  />
                ) : (
                  (typeof val === 'string' && val.length > 80) ? (
                    <textarea
                      className="eim-textarea"
                      rows={3}
                      value={formData[key] ?? ''}
                      onChange={e => handleChange(key, e.target.value, 'string')}
                    />
                  ) : (
                    <input
                      type="text"
                      className="eim-input"
                      value={formData[key] ?? ''}
                      onChange={e => handleChange(key, e.target.value, 'string')}
                    />
                  )
                )}
              </div>
            );
          })}
          <div className="eim-actions">
            <button type="button" className="eim-btn eim-btn-cancel" onClick={onCancel}>Cancel</button>
            <button type="submit" className="eim-btn eim-btn-save">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * EditToolbar — shows at top of page in edit mode.
 */
export function EditToolbar({ editMode, setEditMode, saving }) {
  return (
    <div className="eim-toolbar">
      <button
        className={`eim-toolbar-btn ${editMode ? 'active' : ''}`}
        onClick={() => setEditMode(!editMode)}
      >
        {editMode ? '✓ Done Editing' : '✏️ Edit Mode'}
      </button>
      {saving && <span className="eim-saving">Saving…</span>}
    </div>
  );
}

/**
 * EditOverlay — wraps each item card with edit/delete buttons in edit mode.
 */
export function EditOverlay({ onEdit, onDelete, children }) {
  return (
    <div className="eim-item-wrapper">
      {children}
      <div className="eim-item-actions">
        <button className="eim-item-edit" onClick={onEdit} title="Edit">✏️</button>
        <button className="eim-item-delete" onClick={onDelete} title="Delete">🗑️</button>
      </div>
    </div>
  );
}

/**
 * AddItemButton — shows at end of a section in edit mode.
 */
export function AddItemButton({ onClick, label }) {
  return (
    <button className="eim-add-btn" onClick={onClick}>
      + {label || 'Add Item'}
    </button>
  );
}
