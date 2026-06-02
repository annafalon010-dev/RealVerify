# RealVerify

RealVerify is a luxury real estate verification platform for browsing, uploading, reviewing, and managing verified property listings.

## Tech Stack

- HTML
- CSS
- JavaScript
- Supabase

## How To Run

Open `index.html` with Live Server from your code editor.

## Pages

- `index.html`: Public landing page with RealVerify overview, calls to action, platform stats, and featured properties.
- `property-listing.html`: Public property browsing page with search, filters, verified listing cards, empty states, and pagination.
- `property-details.html`: Property detail page showing images, price, location, verification status, admin notes, similar properties, and suspicious listing reporting.
- `signup.html`: User registration page connected to Supabase Auth and the `profiles` table.
- `login.html`: User sign-in page connected to Supabase Auth.
- `recover.html`: Password recovery page connected to Supabase password reset.
- `dashboard.html`: Authenticated user dashboard for viewing submitted properties, verification status, and notifications.
- `upload.html`: Authenticated property submission page with image uploads, document uploads, and pending verification status.
- `admin-dashboard.html`: Admin review panel for platform stats, pending listing approval/rejection, fraud alerts, and user review.

## Main Files

- `css/style.css`: Global dark luxury design system.
- `css/auth.css`: Authentication page styles.
- `css/property.css`: Property listing and property detail styles.
- `css/dashboard.css`: Dashboard, upload, and admin interface styles.
- `js/supabase.js`: Supabase client initialization.
- `js/auth.js`: Signup, login, password recovery, session helpers, and sign out logic.
- `js/property.js`: Property listing, filters, pagination, detail rendering, similar properties, and reporting logic.
- `js/upload.js`: Property upload form, file previews, Supabase storage uploads, and listing submission.
- `js/dashboard.js`: User dashboard stats, submitted listings, notifications, and dashboard navigation.
- `js/admin.js`: Admin authorization, stats, listing review, notifications, fraud alert display, and users table.
- `js/fraud.js`: Fraud flag utilities, duplicate checks, suspicious upload monitoring, and flag dismissal.

## Supabase Tables Needed

- `profiles`
- `properties`
- `notifications`
- `fraud_flags`

## Supabase Storage Buckets Needed

- `property-images`
- `property-docs`

Configure Supabase Row Level Security policies so users can manage their own records and admins can review, approve, reject, and monitor platform activity.
