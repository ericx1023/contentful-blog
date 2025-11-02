# Dark Theme Implementation Plan

## Overview
This plan outlines the implementation of a dark theme for the Contentful blog site. The implementation will use Tailwind CSS's dark mode capabilities with a theme context provider for state management.

## Current State Analysis
- **Styling**: Uses Tailwind CSS with custom professional color scheme
- **Theme Management**: No existing theme management system
- **Architecture**: Next.js with TypeScript, uses Contentful F36 tokens
- **Components**: Feature-based organization with shared components

## Implementation Strategy

### Phase 1: Foundation Setup
1. **Enable Tailwind Dark Mode**
   - Add `darkMode: 'class'` to tailwind.config.js
   - This allows toggling dark mode via CSS class on document

2. **Update Color System**
   - Extend existing professional color palette with dark mode variants
   - Define semantic color tokens (e.g., bg-primary, text-primary)
   - Ensure accessibility compliance (WCAG contrast ratios)

### Phase 2: Theme Management System
3. **Create Theme Context**
   - `src/contexts/ThemeContext.tsx`
   - Manages theme state (light/dark/system)
   - Provides theme toggle functionality
   - Persists preference in localStorage

4. **Add Theme Provider**
   - Wrap application in theme provider in `_app.page.tsx`
   - Initialize theme from localStorage or system preference
   - Apply theme class to document element

### Phase 3: UI Components
5. **Theme Toggle Component**
   - `src/components/shared/theme-toggle/ThemeToggle.tsx`
   - Icon-based toggle (sun/moon/auto)
   - Accessible with proper ARIA labels
   - Smooth transitions

6. **Update Header Component**
   - Integrate theme toggle in header navigation
   - Ensure proper spacing and alignment
   - Mobile-responsive positioning

### Phase 4: Component Updates
7. **Update Core Components**
   - Header: Dark background, light text
   - Footer: Consistent with header styling
   - Layout: Background color transitions
   - Container: Maintain readability

8. **Update Content Components**
   - Article components: Text and background colors
   - Tile components: Card styling for dark mode
   - Rich text: Ensure content readability
   - Images: Consider dark mode borders/shadows

9. **Update Feature Components**
   - Language selector: Dark mode styling
   - SEO components: No visual changes needed
   - Contentful components: Rich text and embed styling

### Phase 5: Testing & Refinement
10. **Cross-Component Testing**
    - Test all pages in both themes
    - Verify accessibility standards
    - Check color contrast ratios
    - Test theme persistence

11. **Performance Optimization**
    - Minimize layout shifts during theme changes
    - Optimize theme initialization
    - Test bundle size impact

## Technical Specifications

### Color Palette Extensions
```javascript
// Add to tailwind.config.js
const darkModeColors = {
  // Dark backgrounds
  'bg-primary-dark': '#0A0A0A',
  'bg-secondary-dark': '#1A1A1A',
  'bg-tertiary-dark': '#2D2D2D',
  
  // Dark text
  'text-primary-dark': '#FFFFFF',
  'text-secondary-dark': '#E0E0E0',
  'text-muted-dark': '#8C8C8C',
  
  // Dark borders
  'border-dark': '#3F3F3F',
  'border-light-dark': '#555555',
}
```

### Theme Context Interface
```typescript
interface ThemeContextType {
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;
}
```

### Component Pattern
```typescript
// Example component with dark mode support
<div className="bg-white dark:bg-bg-primary-dark text-black dark:text-white">
  <h1 className="text-blue-dark dark:text-blue-accent">Title</h1>
</div>
```

## File Structure
```
src/
├── contexts/
│   └── ThemeContext.tsx
├── hooks/
│   └── useTheme.ts
├── components/
│   └── shared/
│       └── theme-toggle/
│           ├── ThemeToggle.tsx
│           └── index.ts
└── utils/
    └── theme.ts
```

## Dependencies
- No new dependencies required
- Uses existing Tailwind CSS dark mode feature
- Leverages React Context API

## Accessibility Considerations
- Respect system preferences with `prefers-color-scheme`
- Maintain WCAG AA contrast ratios (4.5:1 for normal text)
- Provide clear visual feedback for theme toggle
- Ensure keyboard navigation works in both themes

## Performance Considerations
- Use CSS custom properties for smooth transitions
- Minimize repaints during theme switches
- Lazy load theme-specific assets if needed
- Test Core Web Vitals impact

## Testing Strategy
1. **Manual Testing**
   - Test all pages in both themes
   - Verify theme persistence across sessions
   - Test theme toggle functionality

2. **Accessibility Testing**
   - Use contrast checkers for color combinations
   - Test with screen readers
   - Verify keyboard navigation

3. **Browser Testing**
   - Test across modern browsers
   - Verify system preference detection
   - Test theme initialization

## Rollout Plan
1. Implement foundation (Phases 1-2)
2. Add theme toggle without full styling
3. Gradually update components (Phase 4)
4. Final testing and refinement (Phase 5)
5. Deploy with feature flag if desired

## Success Metrics
- All components properly support both themes
- Theme preference persists across sessions
- No accessibility regressions
- Performance impact < 5% of current load time
- User feedback positive for readability

## Future Enhancements
- Custom theme colors for branding
- Automatic theme switching based on time
- High contrast mode support
- Theme-specific content (images/logos)