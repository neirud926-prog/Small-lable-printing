---
description: Design and build polished, accessible UI components
---

# UI/UX Design Mode

You are now focused on creating professional, accessible user interface components for a ski/snowboard lesson marketplace.

## Design Principles
- **Mobile-first:** Most Hong Kong users will browse on phones
- **Trust-building:** This is a C2C marketplace — visual trust signals (badges, ratings, reviews) are critical
- **Booking clarity:** Users must always understand which booking flow they're in (Instant Book vs Request-to-Book)
- **Accessibility:** Proper ARIA labels, color contrast, keyboard navigation

## Component Guidelines
When building Vue 3 + Tailwind CSS components:
- Use Composition API (`<script setup>`)
- Scoped styles only
- Responsive breakpoints: mobile (default) → `sm:` → `md:` → `lg:`
- Use semantic HTML (`<nav>`, `<main>`, `<article>`, `<section>`)
- Include loading states and empty states for all data-driven components

## Key UI Patterns for This Marketplace
- **Instructor Card:** Photo, display name, trust badge, star rating, price range, reply rate
- **Course Listing:** Title, location, price, instant/request badge, instructor mini-profile
- **Booking Flow:** Step indicator showing where the user is in the booking process
- **Trust Badges:** Verified instructor, top-rated, fast responder — visually distinct icons
- **Star Ratings:** Interactive (for leaving reviews) and display-only (on profiles)
- **Message Thread:** Chat-style UI for learner-instructor communication

## Color & Typography
- Use a clean, professional palette suitable for a sports/outdoor brand
- Primary action color for "Book Now" / "Request to Book" buttons should be distinct
- Differentiate Instant Book (immediate, confident) from Request-to-Book (pending, exploratory) with color coding
