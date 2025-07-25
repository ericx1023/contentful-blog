# Converting n8n Payload from pageBlogPostWithHtml to pageBlogPost

## Overview

This guide explains how to convert your n8n workflow payload from using `pageBlogPostWithHtml` content type to `pageBlogPost` content type in Contentful.

## Key Differences Between Content Types

### pageBlogPostWithHtml (Current)
- **Primary content field**: `html` (Text/Long field)
- **Content format**: Raw HTML/Markdown string
- **Additional fields**: `sourceUrl` for tracking original article source
- **Use case**: Direct HTML/Markdown content storage
- **Rendering**: HTML is rendered directly on frontend

### pageBlogPost (Target)
- **Primary content field**: `content` (Rich Text field)
- **Content format**: Contentful Rich Text JSON structure
- **Missing fields**: No `sourceUrl` field available
- **Use case**: Structured rich text with embeds and references
- **Rendering**: Rich text JSON is processed by Contentful components

## Required Changes

### 1. Update X-Contentful-Content-Type Header

**Current:**
```
X-Contentful-Content-Type: pageBlogPostWithHtml
```

**New:**
```
X-Contentful-Content-Type: pageBlogPost
```

### 2. Transform Payload Structure

**Current n8n Payload:**
```json
{
  "fields": {
    "internalName": {
      "en-US": "{{$('Merge').item.json.title }}" 
    },
    "slug": {
      "en-US": "{{$('RSS').item.json.title.toLowerCase().replace(/ /g, '-') }}"
    },
    "title": {
      "en-US": "{{$('Merge').item.json.title }}"
    },
    "html": {
      "en-US": "{{$('Merge').item.json.text.replace(/\n/g, ' ').replace(/\r/g, '')}}"
    },
    "sourceUrl": {
      "en-US": "{{$('RSS').item.json.link}}"
    }
  }
}
```

**Required New Payload:**
```json
{
  "fields": {
    "internalName": {
      "en-US": "{{$('Merge').item.json.title }}" 
    },
    "slug": {
      "en-US": "{{$('RSS').item.json.title.toLowerCase().replace(/ /g, '-') }}"
    },
    "title": {
      "en-US": "{{$('Merge').item.json.title }}"
    },
    "content": {
      "en-US": {
        "nodeType": "document",
        "data": {},
        "content": [
          {
            "nodeType": "paragraph",
            "data": {},
            "content": [
              {
                "nodeType": "text",
                "value": "{{$('Merge').item.json.text.replace(/\n/g, ' ').replace(/\r/g, '')}}",
                "marks": [],
                "data": {}
              }
            ]
          }
        ]
      }
    }
  }
}
```

### 3. Handle sourceUrl Field Loss

Since `pageBlogPost` doesn't have a `sourceUrl` field, you have two options:

**Option A: Store in content**
Add source URL to the beginning or end of your content:
```json
{
  "nodeType": "paragraph",
  "data": {},
  "content": [
    {
      "nodeType": "text",
      "value": "Source: {{$('RSS').item.json.link}}\n\n{{$('Merge').item.json.text}}",
      "marks": [],
      "data": {}
    }
  ]
}
```

**Option B: Use shortDescription field**
Store source URL in the existing `shortDescription` field:
```json
"shortDescription": {
  "en-US": "Source: {{$('RSS').item.json.link}}"
}
```

## Rich Text JSON Structure

Contentful's rich text uses a specific JSON structure:

### Basic Structure
```json
{
  "nodeType": "document",
  "data": {},
  "content": [
    // Array of content nodes
  ]
}
```

### Common Node Types

**Paragraph:**
```json
{
  "nodeType": "paragraph",
  "data": {},
  "content": [
    {
      "nodeType": "text",
      "value": "Your text content",
      "marks": [],
      "data": {}
    }
  ]
}
```

**Heading:**
```json
{
  "nodeType": "heading-1",
  "data": {},
  "content": [
    {
      "nodeType": "text",
      "value": "Heading Text",
      "marks": [],
      "data": {}
    }
  ]
}
```

**With HTML Content (as plain text):**
```json
{
  "nodeType": "paragraph",
  "data": {},
  "content": [
    {
      "nodeType": "text",
      "value": "<h1>HTML Content</h1><p>This HTML will be displayed as text</p>",
      "marks": [],
      "data": {}
    }
  ]
}
```

## Implementation Strategies

### Strategy 1: Simple Text Conversion (Recommended)
Convert your HTML content to plain text within rich text structure:

```json
"content": {
  "en-US": {
    "nodeType": "document",
    "data": {},
    "content": [
      {
        "nodeType": "paragraph",
        "data": {},
        "content": [
          {
            "nodeType": "text",
            "value": "{{$('Merge').item.json.text}}",
            "marks": [],
            "data": {}
          }
        ]
      }
    ]
  }
}
```

### Strategy 2: HTML Parsing (Complex)
Parse HTML and convert to appropriate rich text nodes. This requires:
- HTML parsing in n8n
- Mapping HTML tags to rich text node types
- Complex transformation logic

### Strategy 3: Hybrid Approach
Keep using `pageBlogPostWithHtml` for automated content, use `pageBlogPost` for manually created articles.

## Frontend Considerations

### Current Rendering (pageBlogPostWithHtml)
```typescript
// In CtfRichText component
if (article.html) {
  return <div dangerouslySetInnerHTML={{ __html: article.html }} />;
}
```

### New Rendering (pageBlogPost)
```typescript
// Uses Contentful rich text renderer
if (article.content) {
  return <CtfRichText {...article.content} />;
}
```

## Testing Recommendations

1. **Start with simple test**: Create a basic article with plain text content
2. **Test HTML handling**: Verify how HTML content appears when stored as text
3. **Frontend verification**: Ensure the rich text renderer displays content correctly
4. **n8n workflow testing**: Test the complete automation pipeline

## Migration Path

If you have existing `pageBlogPostWithHtml` entries:

1. **Dual support**: Keep both content types active
2. **Gradual migration**: Convert content type by type
3. **Frontend updates**: Update rendering logic to handle both types
4. **Data preservation**: Ensure no content is lost during conversion

## Alternatives to Consider

### Option 1: Stay with pageBlogPostWithHtml
- Simpler payload structure
- Direct HTML rendering
- Maintains sourceUrl field
- Less complex conversion

### Option 2: Create Custom Content Type
- Combine benefits of both approaches
- Add sourceUrl to pageBlogPost-like structure
- Requires Contentful space configuration

### Option 3: Use shortDescription for metadata
- Store source URL and other metadata in shortDescription
- Keep main content in rich text format
- Hybrid approach for metadata preservation

## Conclusion

Converting to `pageBlogPost` requires significant payload restructuring and may result in loss of HTML formatting and sourceUrl tracking. Consider whether the benefits of rich text structure outweigh the complexity of conversion.

For automated content workflows, `pageBlogPostWithHtml` may be more suitable unless you specifically need rich text features like embeds and structured content.