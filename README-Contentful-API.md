# Contentful Management API Guide: Creating Markdown Articles with Postman

## Overview

This documentation provides a comprehensive guide for creating Markdown articles in Contentful using the Management API through Postman. Based on research of the existing codebase and Contentful's API documentation, this guide covers everything from basic setup to advanced workflows.

## Table of Contents

- [Prerequisites](#prerequisites)
- [API Architecture Overview](#api-architecture-overview)
- [Authentication Setup](#authentication-setup)
- [Postman Environment Configuration](#postman-environment-configuration)
- [Content Type Structure](#content-type-structure)
- [Step-by-Step Workflows](#step-by-step-workflows)
- [Example API Calls](#example-api-calls)
- [Advanced Patterns](#advanced-patterns)
- [Troubleshooting](#troubleshooting)
- [Reference](#reference)

## Prerequisites

- Contentful account with Management API access
- Postman application installed
- Understanding of REST APIs and JSON
- Access to your Contentful space ID and management token

## API Architecture Overview

### Base API Structure
```
https://api.contentful.com/spaces/{space_id}/environments/{environment_id}
```

### Key Concepts
- **Entries**: Content items (your articles)
- **Assets**: Images, files, and media
- **Content Types**: Schema definitions (PageBlogPostWithHtml)
- **Environments**: Separate content spaces (master, staging, etc.)
- **Locales**: Language variants (en-US, etc.)

### Workflow States
1. **Draft**: Newly created entries (unpublished)
2. **Published**: Live entries visible via Delivery API
3. **Changed**: Published entries with unpublished changes

## Authentication Setup

### Required Tokens
- **Management Token**: Personal access token for API operations
- **Space ID**: Your Contentful space identifier
- **Environment ID**: Usually "master" for production

### Getting Your Management Token
1. Go to Contentful Web App → Settings → API keys
2. Click "Content management tokens" 
3. Generate personal token
4. Copy token (shown only once)

### Security Best Practices
- Store tokens securely
- Use environment variables in Postman
- Never commit tokens to version control
- Regularly rotate tokens

## Postman Environment Configuration

### Environment Variables Setup
Create a new Postman environment with these variables:

```json
{
  "contentful_space_id": "YOUR_SPACE_ID",
  "contentful_environment": "master",
  "contentful_management_token": "YOUR_MANAGEMENT_TOKEN",
  "base_url": "https://api.contentful.com/spaces/{{contentful_space_id}}/environments/{{contentful_environment}}"
}
```

### Global Headers Template
Set these headers for all Contentful requests:

```http
Authorization: Bearer {{contentful_management_token}}
Content-Type: application/vnd.contentful.management.v1+json
```

## Content Type Structure

### PageBlogPostWithHtml Fields

Based on the codebase analysis, the `PageBlogPostWithHtml` content type has these fields:

| Field Name | Type | Required | Description |
|------------|------|----------|-------------|
| `internalName` | Text | No | Internal reference name |
| `slug` | Text | No | URL-friendly identifier |
| `title` | Text | No | Article title |
| `html` | Text (Long) | No | HTML/Markdown content |
| `publishedAt` | Date & Time | No | Custom publication date |
| `author` | Reference | No | Link to ComponentAuthor |
| `featuredImage` | Media | No | Featured image asset |

### Locale Structure
All fields use locale-specific values:
```json
{
  "fieldName": {
    "en-US": "field value"
  }
}
```

## Step-by-Step Workflows

### Workflow 1: Create Basic Article

#### Step 1: Inspect Content Type
**Method**: `GET`  
**URL**: `{{base_url}}/content_types/pageBlogPostWithHtml`  
**Purpose**: Verify field structure

#### Step 2: Create Draft Entry
**Method**: `POST`  
**URL**: `{{base_url}}/entries`  
**Headers**: Add `X-Contentful-Content-Type: pageBlogPostWithHtml`

**Body**:
```json
{
  "fields": {
    "internalName": {
      "en-US": "My Test Article - {{$timestamp}}"
    },
    "slug": {
      "en-US": "test-article-{{$timestamp}}"
    },
    "title": {
      "en-US": "My Test Markdown Article"
    },
    "html": {
      "en-US": "<h1>Test Article</h1><p>This is my markdown content.</p>"
    }
  }
}
```

#### Step 3: Publish Entry
**Method**: `PUT`  
**URL**: `{{base_url}}/entries/{{entry_id}}/published`  
**Headers**: Add `X-Contentful-Version: 1`  
**Body**: Empty

### Workflow 2: Create Article with References

#### Step 1: Find Available Authors
**Method**: `GET`  
**URL**: `{{base_url}}/entries?content_type=componentAuthor&limit=5`

#### Step 2: Find Available Assets
**Method**: `GET`  
**URL**: `{{base_url}}/assets?limit=5`

#### Step 3: Create Complete Article
Use the IDs from steps 1-2 in your article creation:

```json
{
  "fields": {
    "title": {
      "en-US": "Complete Article Example"
    },
    "html": {
      "en-US": "<h1>Full Article</h1><p>With references.</p>"
    },
    "author": {
      "en-US": {
        "sys": {
          "type": "Link",
          "linkType": "Entry",
          "id": "AUTHOR_ENTRY_ID"
        }
      }
    },
    "featuredImage": {
      "en-US": {
        "sys": {
          "type": "Link",
          "linkType": "Asset",
          "id": "ASSET_ID"
        }
      }
    }
  }
}
```

## Example API Calls

### 1. Minimal Article Creation
```http
POST {{base_url}}/entries
X-Contentful-Content-Type: pageBlogPostWithHtml

{
  "fields": {
    "title": {
      "en-US": "Minimal Test Article"
    },
    "html": {
      "en-US": "<p>Just a simple test</p>"
    }
  }
}
```

### 2. Full-Featured Article
```http
POST {{base_url}}/entries
X-Contentful-Content-Type: pageBlogPostWithHtml

{
  "fields": {
    "internalName": {
      "en-US": "Complete Blog Post Example"
    },
    "slug": {
      "en-US": "complete-blog-post-example"
    },
    "title": {
      "en-US": "A Complete Blog Post with All Features"
    },
    "html": {
      "en-US": "<!DOCTYPE html><html><body><h1>Complete Article</h1><p>This article has <strong>formatting</strong>, <em>styles</em>, and <a href='#'>links</a>.</p><blockquote>A meaningful quote here.</blockquote><ul><li>Point one</li><li>Point two</li></ul><pre><code>const example = 'code block';</code></pre></body></html>"
    },
    "publishedAt": {
      "en-US": "2025-01-20T15:30:00.000Z"
    },
    "author": {
      "en-US": {
        "sys": {
          "type": "Link",
          "linkType": "Entry",
          "id": "your-author-id"
        }
      }
    },
    "featuredImage": {
      "en-US": {
        "sys": {
          "type": "Link",
          "linkType": "Asset",
          "id": "your-image-id"
        }
      }
    }
  }
}
```

### 3. Markdown-to-HTML Example
```http
POST {{base_url}}/entries
X-Contentful-Content-Type: pageBlogPostWithHtml

{
  "fields": {
    "title": {
      "en-US": "Converted from Markdown"
    },
    "html": {
      "en-US": "<h2>This was Markdown</h2><p>Original markdown:</p><pre># Heading 2\n\nSome **bold** and *italic* text.\n\n- List item 1\n- List item 2</pre><p>Now converted to HTML for Contentful.</p>"
    }
  }
}
```

## Advanced Patterns

### Postman Pre-Request Scripts
Add to collection/request pre-request scripts:

```javascript
// Generate unique slug
pm.environment.set("unique_slug", "article-" + Date.now());

// Set current timestamp
pm.environment.set("current_timestamp", new Date().toISOString());

// Generate random title
pm.environment.set("random_title", "Test Article " + Math.floor(Math.random() * 1000));
```

### Postman Test Scripts
Add to requests for automation:

```javascript
// Store entry details for subsequent requests
if (pm.response.code === 201) {
    const response = pm.response.json();
    pm.environment.set("last_entry_id", response.sys.id);
    pm.environment.set("entry_version", response.sys.version);
    
    console.log("Created entry:", response.sys.id);
}

// Verify successful creation
pm.test("Article created successfully", function () {
    pm.response.to.have.status(201);
    pm.expect(pm.response.json().fields).to.not.be.empty;
});

// Verify required fields
pm.test("Title field exists", function () {
    const response = pm.response.json();
    pm.expect(response.fields.title).to.not.be.undefined;
});
```

### Batch Operations Pattern
For creating multiple articles, use Postman Collection Runner:

1. Create collection with article creation request
2. Prepare CSV/JSON data file with article data
3. Use data file in Collection Runner
4. Set delays between requests (rate limiting)

## Troubleshooting

### Common Errors and Solutions

#### 401 Unauthorized
**Problem**: Invalid or missing authentication  
**Solutions**:
- Verify management token is correct
- Check Bearer prefix in Authorization header
- Ensure token has proper permissions

#### 400 Bad Request
**Problem**: Invalid request format  
**Solutions**:
- Verify `X-Contentful-Content-Type` header
- Check JSON syntax and structure
- Ensure locale format (`en-US`)

#### 422 Unprocessable Entity
**Problem**: Field validation errors  
**Solutions**:
- Check field names match content type exactly
- Verify required fields are provided
- Validate field value formats (dates, references)

#### 404 Not Found
**Problem**: Invalid space ID or content type  
**Solutions**:
- Verify space ID in environment variables
- Check content type name spelling
- Ensure proper environment (master vs others)

#### 429 Too Many Requests
**Problem**: Rate limit exceeded (7 requests/second)  
**Solutions**:
- Add delays between requests
- Use exponential backoff
- Batch operations when possible

#### 409 Version Conflict
**Problem**: Concurrent modifications  
**Solutions**:
- Use `X-Contentful-Version` header for updates
- Get current version before updating
- Handle conflicts gracefully

### Link Reference Errors
**Problem**: Invalid author or asset references  
**Solutions**:
- Verify referenced entry/asset IDs exist
- Check link structure format
- Ensure referenced content is published (if needed)

### HTML Content Issues
**Problem**: HTML not rendering correctly  
**Solutions**:
- Validate HTML syntax
- Check for security restrictions
- Test with simple HTML first

## Reference

### Essential Endpoints

| Operation | Method | Endpoint | Purpose |
|-----------|--------|----------|---------|
| List entries | GET | `/entries` | View existing content |
| Create entry | POST | `/entries` | Create new article |
| Get entry | GET | `/entries/{id}` | Retrieve specific article |
| Update entry | PUT | `/entries/{id}` | Modify existing article |
| Publish entry | PUT | `/entries/{id}/published` | Make article live |
| Unpublish entry | DELETE | `/entries/{id}/published` | Remove from public |
| List assets | GET | `/assets` | View available images |
| Get content type | GET | `/content_types/{id}` | Inspect field structure |

### Response Format Examples

#### Successful Creation (201)
```json
{
  "sys": {
    "type": "Entry",
    "id": "generated-entry-id",
    "space": {"sys": {"type": "Link", "linkType": "Space", "id": "space-id"}},
    "environment": {"sys": {"id": "master", "type": "Link", "linkType": "Environment"}},
    "contentType": {"sys": {"type": "Link", "linkType": "ContentType", "id": "pageBlogPostWithHtml"}},
    "createdAt": "2025-01-20T10:00:00.000Z",
    "updatedAt": "2025-01-20T10:00:00.000Z",
    "version": 1
  },
  "fields": {
    "title": {"en-US": "Your Article Title"},
    "html": {"en-US": "<p>Your content</p>"}
  }
}
```

#### Publication Success (200)
```json
{
  "sys": {
    "type": "Entry",
    "id": "entry-id",
    "publishedAt": "2025-01-20T10:05:00.000Z",
    "publishedVersion": 1,
    "version": 1
  },
  "fields": {
    // Same field structure
  }
}
```

### Rate Limits
- **Default**: 7 requests per second
- **Burst**: Up to 10 requests briefly
- **Headers**: Check `X-Contentful-RateLimit-*` response headers

### Best Practices
1. Always validate linked entries exist before referencing
2. Use descriptive `internalName` values for content management
3. Test with minimal payloads first
4. Handle errors gracefully with proper HTTP status checking
5. Use environment variables for sensitive data
6. Implement proper logging for debugging

### Additional Resources
- [Contentful Management API Documentation](https://www.contentful.com/developers/docs/references/content-management-api/)
- [Content Type Management](https://www.contentful.com/developers/docs/concepts/data-model/)
- [Authentication Guide](https://www.contentful.com/developers/docs/references/authentication/)

---

*This documentation is based on research of the contentful-blog codebase and official Contentful API documentation. Last updated: January 2025*


CMA Personal access token
CFPAT-gxaoAsRpjLDqUwjz5iKkTVQ5gB4cXG-jQEsxAV3haa4