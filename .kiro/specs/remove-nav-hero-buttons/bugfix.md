# Bugfix Requirements Document

## Introduction

The CivicAlert UI contains unwanted navigation elements that should not be present in the final product. Specifically, a "View Dashboard" button appears in the home page hero section, and "Home" and "Report" navigation links appear in the Navbar. These elements clutter the UI and need to be removed as part of a UI cleanup.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user visits the home page THEN the system renders a "View Dashboard" button in the hero section alongside the "Report Emergency" button
1.2 WHEN a user views the Navbar on the main app THEN the system renders a "Home & Report" navigation link in the desktop nav links area
1.3 WHEN a user opens the mobile menu THEN the system renders a "Home & Report" navigation link in the mobile menu

### Expected Behavior (Correct)

2.1 WHEN a user visits the home page THEN the system SHALL render only the "Report Emergency" button in the hero CTA area, without a "View Dashboard" button
2.2 WHEN a user views the Navbar on the main app THEN the system SHALL NOT render any links in the desktop nav links area
2.3 WHEN a user opens the mobile menu THEN the system SHALL NOT render any navigation links derived from mainNavLinks

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user views the Navbar THEN the system SHALL CONTINUE TO render the CivicAlert logo and the "Report Emergency" emergency CTA button
3.2 WHEN a user visits the home page THEN the system SHALL CONTINUE TO render the "Report Emergency" primary CTA button in the hero section
3.3 WHEN a user is on the agencies portal THEN the system SHALL CONTINUE TO render the agencies portal navbar with all agency links unchanged
3.4 WHEN a user scrolls the page THEN the system SHALL CONTINUE TO apply the scrolled navbar style correctly
