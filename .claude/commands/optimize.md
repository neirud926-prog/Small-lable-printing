---
description: Analyze code for performance bottlenecks and suggest optimizations
---

# Optimization Analysis

Analyze the specified code or area for performance issues. Focus on what matters for a Flask + PostgreSQL marketplace application.

## Database & Query Optimization
- Identify N+1 query problems in SQLAlchemy relationships
- Check for missing database indexes on frequently queried columns (e.g., `email`, `instructor_id`, `status_id`, `course_id`)
- Look for unnecessary `db.session.commit()` calls or missing bulk operations
- Verify eager loading (`joinedload`, `subqueryload`) is used where appropriate
- Check if aggregate queries (average rating, total students) can be optimized with database-level calculations

## API & Route Optimization
- Identify redundant database calls within a single request
- Check pagination on list endpoints (courses, bookings, messages)
- Verify proper use of HTTP caching headers for static data
- Look for expensive operations that should be deferred or cached

## Frontend Performance (Vue.js)
- Check for unnecessary re-renders and missing `computed` properties
- Verify lazy loading of routes and components
- Look for missing debounce on search/filter inputs
- Check image optimization for instructor profiles and course photos

## Output Format
For each finding, provide:
1. **What:** The specific issue found
2. **Where:** File and line number
3. **Impact:** How it affects performance (Low/Medium/High)
4. **Fix:** The specific code change needed
5. **Academic note:** How to describe this optimization in the FYP report
