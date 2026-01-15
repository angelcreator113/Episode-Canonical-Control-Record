# TagInput - Quick Reference

## Import
```jsx
import TagInput from '../components/TagInput';
```

## Basic Usage
```jsx
const [tags, setTags] = useState([]);

<TagInput
  tags={tags}
  onChange={setTags}
/>
```

## With All Options
```jsx
<TagInput
  tags={formData.categories}           // Required: current tags array
  onChange={handleCategoriesChange}    // Required: onChange callback
  placeholder="Add categories..."       // Optional: input placeholder
  disabled={loading}                    // Optional: disable component
  maxTags={10}                         // Optional: max tags limit
/>
```

## Handler Function
```jsx
const handleCategoriesChange = (categories) => {
  setFormData((prev) => ({
    ...prev,
    categories: categories,
  }));
};
```

## Keyboard Controls
| Key | Action |
|-----|--------|
| **Enter** | Add tag |
| **Comma (,)** | Add tag |
| **Backspace** | Remove last tag (if input empty) |
| **X button** | Remove specific tag |
| **Click away** | Add tag (if input has text) |

## Props Reference

```jsx
TagInput.propTypes = {
  tags: PropTypes.array,           // [string, string, ...]
  onChange: PropTypes.func,         // (newTags) => void
  placeholder: PropTypes.string,    // Default: "Add tags..."
  disabled: PropTypes.bool,         // Default: false
  maxTags: PropTypes.number,        // Default: null (unlimited)
}

TagInput.defaultProps = {
  tags: [],
  placeholder: "Add tags...",
  disabled: false,
  maxTags: null,
}
```

## Features at a Glance

✅ **Add tags**: Enter, comma, or blur  
✅ **Remove tags**: X button or Backspace  
✅ **Prevent duplicates**: Automatic  
✅ **Prevent empty**: Automatic  
✅ **Limit tags**: Optional maxTags prop  
✅ **Responsive**: Mobile/tablet friendly  
✅ **Keyboard hints**: User guidance included  
✅ **Accessible**: ARIA labels included  

## In CreateEpisode (Current Implementation)
```jsx
<TagInput
  tags={formData.categories}
  onChange={handleCategoriesChange}
  placeholder="Add categories (e.g., fashion, tutorial, shopping)"
  disabled={loading}
  maxTags={10}
/>
```

## In EditEpisode (Current Implementation)
```jsx
<TagInput
  tags={formData.categories}
  onChange={handleCategoriesChange}
  placeholder="Add categories (e.g., fashion, tutorial, shopping)"
  disabled={submitting}
  maxTags={10}
/>
```

## CSS Classes (For Styling)

```css
.tag-input-container           /* Wrapper container */
.tag-input-wrapper             /* Flex container for tags */
.tag                           /* Individual tag */
.tag-remove                    /* X button on tag */
.tag-input                     /* Input field */
.tag-input-hint                /* Helper text below */
.tag-input-limit               /* Max limit text */
.tag-input-count               /* Tag counter text */
```

## Customization Examples

### Change tag color to blue
```css
.tag {
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
}
```

### Change tag color to green
```css
.tag {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}
```

### Increase input height
```css
.tag-input-wrapper {
  min-height: 60px;
  padding: 1rem;
}
```

## Common Patterns

### Form with tags
```jsx
const [formData, setFormData] = useState({
  name: '',
  tags: [],
});

const handleTagsChange = (tags) => {
  setFormData(prev => ({ ...prev, tags }));
};

return (
  <form onSubmit={handleSubmit}>
    <input 
      value={formData.name}
      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
    />
    <TagInput
      tags={formData.tags}
      onChange={handleTagsChange}
    />
    <button type="submit">Submit</button>
  </form>
);
```

### Conditional rendering
```jsx
{formData.categories.length > 0 && (
  <TagInput
    tags={formData.categories}
    onChange={handleCategoriesChange}
  />
)}
```

### With validation
```jsx
const isValid = formData.categories.length >= 1 && 
                formData.categories.length <= 10;

<TagInput
  tags={formData.categories}
  onChange={handleCategoriesChange}
  maxTags={10}
/>
{!isValid && <p>Please add 1-10 categories</p>}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tags not showing | Check `onChange` updates parent state correctly |
| Input not clearing | It's automatic, make sure `onChange` works |
| Duplicates appearing | Should be prevented - check component imported correctly |
| Styling wrong | Ensure `TagInput.css` is imported in component |
| Mobile looks bad | Component is responsive, check parent container width |
| Can't remove tags | Try X button or Backspace with empty input |

## Files
- Component: `frontend/src/components/TagInput.jsx`
- Styling: `frontend/src/components/TagInput.css`
- Guide: `TAG_INPUT_GUIDE.md`
- Implementation: `TAGINPUT_IMPLEMENTATION.md`

## Quick Start (Copy-Paste)
```jsx
import TagInput from '../components/TagInput';

function MyComponent() {
  const [tags, setTags] = useState([]);

  return (
    <div>
      <h3>Tags</h3>
      <TagInput
        tags={tags}
        onChange={setTags}
        placeholder="Add tags..."
        maxTags={10}
      />
    </div>
  );
}
```

Done! 🚀
