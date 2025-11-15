# USA Scoops Design Guidelines

## Design Approach

**Primary System**: Material Design 3 via Material-UI (MUI)
- Clean, functional aesthetic appropriate for service booking platform
- Strong visual hierarchy through elevation and spacing
- Consistent component patterns across customer, technician, and admin interfaces

**Landing Page Inspiration**: Service booking platforms (Rover, TaskRabbit, local service providers)
- Approachable, trustworthy visual tone
- Clear value proposition with immediate action path
- Professional yet friendly for residential customer base

## Typography

**Font Family**: Roboto (Material Design default) via Google Fonts
- Headlines: Roboto 600-700 weight
- Body: Roboto 400 weight
- Buttons/Labels: Roboto 500 weight

**Hierarchy**:
- H1 (Hero): 3rem (48px) desktop, 2rem (32px) mobile
- H2 (Section Headers): 2.5rem (40px) desktop, 1.75rem (28px) mobile
- H3 (Subsections): 1.75rem (28px) desktop, 1.5rem (24px) mobile
- Body: 1rem (16px)
- Small/Caption: 0.875rem (14px)

## Layout System

**Spacing Units**: Tailwind-compatible Material spacing
- Primary units: 2, 4, 8, 12, 16, 24 (equivalent to 8px, 16px, 32px, 48px, 64px, 96px)
- Section padding: py-16 to py-24 desktop, py-12 mobile
- Component spacing: gap-4 to gap-8
- Card padding: p-6 to p-8

**Container Widths**:
- Landing page: max-w-7xl (1280px)
- Portal/dashboard content: max-w-6xl (1152px)
- Forms: max-w-2xl (672px)

## Component Library

### Navigation
- **Header**: Fixed top position, white background, subtle shadow (elevation 1), 64px height, logo left, nav links center, CTA button right
- **Logo Area**: h-12 (48px) placeholder with subtle border, easily replaceable

### Landing Page Components

**Hero Section**:
- Height: 85vh minimum
- Full-width background image with overlay (dark gradient overlay for text readability)
- Centered content: headline + subheadline + primary CTA button
- CTA button: Large (56px height), blurred background backdrop for visibility on image

**How It Works Section**:
- 3-column grid (desktop), stacked (mobile)
- Each step: Icon (80px circle with Material Icons), title, brief description
- Grid: grid-cols-1 md:grid-cols-3 gap-8

**Call-to-Action Section**:
- Contrasting background (Material primary color)
- Centered content with secondary CTA

### Forms & Inputs
- Material-UI TextField components with outlined variant
- Spacing: mb-4 between fields
- Full width inputs within form containers
- Helper text for validation feedback
- Primary button: contained variant, secondary: outlined variant

### Portals & Dashboards

**Customer Portal**:
- Card-based layout for next visit (prominent, elevated)
- Table component for visit history with alternating row colors
- Contact form in card component

**Technician Portal**:
- Date picker at top
- Visit list as Material-UI Table with sortable headers
- Action buttons (Mark Completed) as chip or icon button in table rows

**Admin Dashboard**:
- Material-UI Tabs for section navigation
- Tables with pagination for data display
- Forms in Paper components with elevation 2
- Data tables with built-in filtering and sorting

### Cards
- Elevation: 2 for standard cards, 4 for emphasized content
- Border radius: 12px (rounded-xl)
- Padding: p-6
- Shadow: Material elevation system

### Buttons
- Primary actions: contained variant, 48px height
- Secondary actions: outlined variant, 40px height
- Icon buttons: 40px square for table actions
- Button groups: spacing gap-3

## Images

**Hero Section**: 
- Full-width background image of clean, well-maintained residential yard with happy dog
- Professional photography style, bright and welcoming
- Image dimensions: 1920x1080 minimum
- Dark gradient overlay (linear-gradient from transparent to rgba(0,0,0,0.4))

**How It Works Icons**:
- Material Icons: location_on (zip check), schedule (time picker), check_circle (service completion)
- Size: 80px, circular background with primary color at 10% opacity

**Logo Placeholder**:
- Rectangular area 180x48px in header
- Border: 2px dashed gray-300 with text "USA Scoops Logo"

## Page-Specific Guidelines

### Landing Page
- Hero section with background image (85vh)
- How It Works section (3 columns with icons)
- Brief benefits section (2-column layout: text + supporting image of technician/service)
- Final CTA section with conversion button
- Footer with contact info and social links

### Signup Flow
- Multi-step form with Material-UI Stepper component showing progress
- Each step in centered max-w-2xl container
- Step indicators at top
- Previous/Next buttons at bottom of each step
- Zip validation shows inline success/error states

### Portals
- Sidebar navigation (permanent drawer on desktop, temporary on mobile)
- Main content area with generous padding
- Dashboard cards in grid layout
- Tables with Material-UI DataGrid for advanced features

### Admin Dashboard
- Horizontal tabs for major sections
- Each tab contains relevant forms and tables
- Action buttons consistently placed top-right of sections
- Confirmation dialogs for destructive actions

## Accessibility
- Material-UI components provide built-in ARIA attributes
- Form labels always visible (not just placeholder)
- Sufficient color contrast (WCAG AA minimum)
- Focus states clearly visible
- Keyboard navigation support throughout