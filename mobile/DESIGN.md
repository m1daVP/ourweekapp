---
name: OurWeek Design System
colors:
  surface: '#faf9f5'
  surface-dim: '#dadad6'
  surface-bright: '#faf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f4ef'
  surface-container: '#eeeeea'
  surface-container-high: '#e8e8e4'
  surface-container-highest: '#e3e3df'
  on-surface: '#1a1c1a'
  on-surface-variant: '#424842'
  inverse-surface: '#2f312e'
  inverse-on-surface: '#f1f1ed'
  outline: '#737971'
  outline-variant: '#c2c8bf'
  surface-tint: '#47654b'
  primary: '#456349'
  on-primary: '#ffffff'
  primary-container: '#5d7c60'
  on-primary-container: '#f7fff3'
  inverse-primary: '#adcfaf'
  secondary: '#7e5622'
  on-secondary: '#ffffff'
  secondary-container: '#fec889'
  on-secondary-container: '#79521e'
  tertiary: '#7c5059'
  on-tertiary: '#ffffff'
  tertiary-container: '#976871'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c9ebca'
  primary-fixed-dim: '#adcfaf'
  on-primary-fixed: '#03210c'
  on-primary-fixed-variant: '#304d35'
  secondary-fixed: '#ffddb9'
  secondary-fixed-dim: '#f2bd7f'
  on-secondary-fixed: '#2b1700'
  on-secondary-fixed-variant: '#633f0b'
  tertiary-fixed: '#ffd9df'
  tertiary-fixed-dim: '#f1b8c2'
  on-tertiary-fixed: '#311119'
  on-tertiary-fixed-variant: '#643b44'
  background: '#faf9f5'
  on-background: '#1a1c1a'
  surface-variant: '#e3e3df'
typography:
  display:
    fontFamily: literata
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: literata
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: literata
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: beVietnamPro
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: beVietnamPro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: beVietnamPro
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: beVietnamPro
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  container_max_width: 480px
  edge_margin: 24px
  stack_gap: 16px
  section_gap: 32px
  grid_columns: '4'
  gutter: 16px
---

## Brand & Style

The design system is crafted to evoke a sense of digital sanctuary for families and couples. It avoids the cold efficiency of productivity tools, instead opting for a **Warm Minimalist** aesthetic that feels intentional and grounding.

The visual narrative prioritizes emotional safety and focus. By utilizing soft, organic textures and a palette inspired by natural materials (linen, sage, and clay), the interface encourages users to slow down and engage in meaningful reflection. The Android-first approach ensures that interaction patterns feel native yet elevated through custom tactile feedback and smooth transitions between check-in states.

## Colors

The palette is centered on a "Sage and Earth" theme. The primary green (`#6f8f72`) represents growth and harmony, used for progression and primary actions. The secondary amber (`#d9a66a`) acts as a warm accent for highlights and premium features.

The background (`#faf7f2`) is a warm off-white that reduces eye strain compared to pure white, creating a paper-like feel. Participant colors are muted and earthy, ensuring that even with multiple users on screen, the UI remains cohesive and calm.

## Typography

This design system employs a sophisticated pairing of **Literata** and **Be Vietnam Pro**.

- **Literata (Serif):** Used for headlines and reflective prompts. Its literary qualities make check-in questions feel like a shared journal entry rather than a form to be filled.
- **Be Vietnam Pro (Sans-Serif):** Used for functional UI elements, labels, and long-form body text. Its modern, approachable character maintains readability and high utility.

Text colors should strictly follow the hierarchy: `#2f2a26` for headers and primary reading, and `#7a7168` for secondary metadata and instructional hints.

## Layout & Spacing

The layout is optimized for a handheld, Android-first experience with a maximum shell width of **480px**.

- **Fixed Grid:** Within the mobile shell, use a 4-column grid.
- **Generous Margins:** 24px side margins are mandatory to prevent the UI from feeling "cramped" and to support the calm aesthetic.
- **Vertical Rhythm:** Use a baseline of 8px. Components should be separated by 16px (stack) or 32px (sections) to create an airy, breathable flow.
- **Safe Areas:** Ensure bottom navigation and floating actions account for Android gesture bars.

## Elevation & Depth

Depth is created through **Tonal Layering** rather than heavy shadows.

1. **Level 0 (Base):** The Warm Background (`#faf7f2`).
2. **Level 1 (Muted Panels):** Soft Surface (`#f3eee7`) with no shadow, used for inset content or grouped background info.
3. **Level 2 (Cards/Primary Surface):** White Surface (`#ffffff`) with a very soft, diffused shadow: `0 4px 20px rgba(47, 42, 38, 0.05)`.
4. **Level 3 (Modals/Overlays):** White Surface (`#ffffff`) with a more defined shadow: `0 8px 32px rgba(47, 42, 38, 0.12)`.

Avoid pure black shadows; always tint shadows with the `#2f2a26` text color at low opacities to maintain the "warm" feel.

## Shapes

The shape language is defined by high-radius, pill-like curves. All primary containers and buttons must use a corner radius of at least **16px (1rem)**.

- **Small elements (Chips, Tags):** Fully rounded (Pill).
- **Cards & Inputs:** 16px to 24px.
- **Bottom Sheets:** 32px top-corner radius to create a "hugged" feeling for the content.
- **Avatars:** Circular (100% radius) to contrast against the softened rectangular cards.

## Components

### Buttons

- **Primary:** Sage (`#6f8f72`) with White text. Bold, 56px height for touch-friendliness. 24px radius.
- **Secondary:** Amber Soft (`#f4e3cc`) with Amber Dark text. Used for less urgent actions or "Add Item" buttons.
- **Ghost:** Transparent background with Sage text for navigation within the flow.

### Cards

Cards are the primary vehicle for "Meeting Topics." They feature a white background, 20px rounded corners, and a subtle border (`#e3d9cd`) to separate them from the background if elevation shadows are disabled for performance.

### Inputs

Text fields use the Soft Surface (`#f3eee7`) as a fill, no border unless focused. When focused, they gain a 2px Sage border. Labels are always positioned above the field in `label-lg` style.

### Bottom Navigation

The 5-item bottom bar (Home, Meeting, Tasks, History, Settings) uses a blurred white surface. The active icon is highlighted using Sage (`#6f8f72`) and a small soft green dot or indicator below the icon.

### Participant Avatars

Circular avatars with a 2px white border. In list views, use "Avatar Stacks" where avatars overlap slightly to show family togetherness.

### Progress Indicators

Thin, rounded horizontal bars using Primary Soft as the track and Primary as the fill. Used for "Meeting Completion" percentages.
