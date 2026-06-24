# Supabase Database Setup Guide — Atlas Hotel

This guide walks you through migrating from the local SQLite database (`data/hotel.db`) to Supabase PostgreSQL.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Enter a name (e.g. `Atlas Hotel`).
4. Set a secure **Database Password** — save it somewhere safe.
5. Choose a region close to you.
6. Click **Create new project** (takes ~1–2 minutes).

## 2. Get Your Project Credentials

In the project dashboard:

1. Go to **Project Settings → API** (left sidebar).
2. Under **Project API keys**, copy:
   - `Project URL` (looks like `https://xxxxxxxxxxxx.supabase.co`)
   - `anon` public key
   - `service_role` key (keep secret — never expose client-side)
3. Under **Project Settings → Database**, copy your **Connection string** (for direct connections).

## 3. Run the Migration SQL

Go to **SQL Editor** in the Supabase dashboard, paste the following, and click **Run**:

```sql
-- ============================================================
-- Atlas Hotel — Supabase Schema Migration
-- ============================================================

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  description TEXT,
  amenities TEXT,
  price_per_night NUMERIC(10,2) NOT NULL,
  available_units INTEGER DEFAULT 5,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  booking_number TEXT UNIQUE NOT NULL,
  room_id BIGINT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INTEGER NOT NULL,
  special_requests TEXT,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Booking counter (used for generating booking numbers)
CREATE TABLE IF NOT EXISTS booking_counter (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  counter INTEGER DEFAULT 0
);

-- Services
CREATE TABLE IF NOT EXISTS services (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events
CREATE TABLE IF NOT EXISTS events_tbl (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title TEXT NOT NULL,
  description TEXT,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Offers
CREATE TABLE IF NOT EXISTS offers (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title TEXT NOT NULL,
  description TEXT,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gallery
CREATE TABLE IF NOT EXISTS gallery (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  image TEXT NOT NULL,
  caption TEXT,
  section TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Testimonials
CREATE TABLE IF NOT EXISTS testimonials (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admins
CREATE TABLE IF NOT EXISTS admins (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

-- Settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  key TEXT UNIQUE NOT NULL,
  value TEXT
);

-- Hotel Info (key-value store)
CREATE TABLE IF NOT EXISTS hotel_info (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  key TEXT UNIQUE NOT NULL,
  value TEXT
);

-- ============================================================
-- Seed Data
-- ============================================================

-- Default admin (change password after first login)
INSERT INTO admins (username, password)
SELECT 'admin', '$2a$10$dummyplaceholder'
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE username = 'admin');

-- Booking counter start
INSERT INTO booking_counter (counter)
SELECT 0
WHERE NOT EXISTS (SELECT 1 FROM booking_counter);

-- Rooms
INSERT INTO rooms (name, description, amenities, price_per_night, available_units)
SELECT * FROM (VALUES
  ('Standard Room',   'Comfortable and elegant room with modern amenities. Perfect for solo travelers or couples.',   '["5G WiFi","LED TV","Mini Bar","Room Service","Air Conditioning"]',                              150, 10),
  ('Deluxe Room',     'Spacious room with premium furnishings and stunning city views.',                              '["5G WiFi","LED TV","Mini Bar","Room Service","Air Conditioning","Bathtub","Turndown Service"]',     250, 8),
  ('Executive Suite',  'Luxurious suite with separate living area, panoramic views, and VIP treatment.',               '["5G WiFi","LED TV","Mini Bar","Room Service","Air Conditioning","Bathtub","Turndown Service","Gym Access","Lounge Access","Butler Service"]', 450, 5),
  ('Presidential Suite','The pinnacle of luxury. Expansive space, private terrace, and personalized concierge service.','["5G WiFi","LED TV","Mini Bar","Room Service","Air Conditioning","Bathtub","Turndown Service","Gym Access","Lounge Access","Butler Service","Private Terrace","Jacuzzi","Personal Concierge"]', 850, 2)
) AS v
WHERE NOT EXISTS (SELECT 1 FROM rooms);

-- Services
INSERT INTO services (name, description)
SELECT * FROM (VALUES
  ('5G WiFi',            'Enjoy our premium 5G wifi service.'),
  ('24hr Room Service',  'Enjoy our premium 24hr room service.'),
  ('Restaurant & Bar',   'Enjoy our premium restaurant & bar service.'),
  ('Mini Bar',           'Enjoy our premium mini bar service.'),
  ('Gym & Fitness Center','Enjoy our premium gym & fitness center service.'),
  ('Spa & Wellness',     'Enjoy our premium spa & wellness service.'),
  ('Concierge Service',  'Enjoy our premium concierge service.'),
  ('Laundry Service',    'Enjoy our premium laundry service.'),
  ('Airport Transfer',   'Enjoy our premium airport transfer service.'),
  ('Parking',            'Enjoy our premium parking service.')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM services);

-- Events
INSERT INTO events_tbl (title, description)
SELECT * FROM (VALUES
  ('Wedding Celebrations',     'Make your special day unforgettable with our elegant wedding venues, expert planning, and exceptional catering.'),
  ('Corporate Events & Seminars','Fully equipped conference halls with state-of-the-art technology for meetings, seminars, and corporate retreats.'),
  ('Private Parties',          'Celebrate birthdays, anniversaries, and milestones in style with our customizable party packages.'),
  ('Gala Dinners',             'Annual charity galas and formal dinner events held in our grand ballroom.')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM events_tbl);

-- Offers
INSERT INTO offers (title, description)
SELECT * FROM (VALUES
  ('Stay 3 Pay 2',       'Book 3 nights and pay for only 2! Available on Standard and Deluxe rooms.'),
  ('Book Direct 5% Off', 'Book directly through our website and save 5% on your total stay.'),
  ('Summer Escape',      'Enjoy 15% off on Executive Suites this summer season.'),
  ('Honeymoon Package',  'Romantic getaway with champagne, spa session, and late checkout.')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM offers);

-- Menu Items
INSERT INTO menu_items (name, description)
SELECT * FROM (VALUES
  ('Grilled Atlantic Salmon', 'Fresh salmon fillet with lemon butter sauce, seasonal vegetables, and herb-roasted potatoes.'),
  ('Wagyu Beef Steak',       'Premium Japanese Wagyu cooked to perfection, served with truffle mash and red wine jus.'),
  ('Caesar Salad',           'Crisp romaine lettuce, parmesan, croutons, and our signature house-made dressing.'),
  ('Tiramisu',               'Classic Italian dessert with espresso-soaked ladyfingers and mascarpone cream.'),
  ('Signature Cocktails',    'Handcrafted cocktails by our award-winning mixologists using premium spirits.')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM menu_items);

-- Testimonials
INSERT INTO testimonials (name, content)
SELECT * FROM (VALUES
  ('Sarah M.', 'An absolutely stunning experience from check-in to check-out. The staff went above and beyond to make our anniversary special.'),
  ('James K.', 'The Presidential Suite was breathtaking. Best hotel experience we have ever had. Will definitely return!'),
  ('Maria L.', 'Excellent business facilities combined with luxury comfort. The conference team was incredibly professional.'),
  ('David R.', 'The restaurant is world-class. We dined there every night of our stay and every dish was perfection.')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM testimonials);

-- Hotel Info
INSERT INTO hotel_info (key, value)
SELECT * FROM (VALUES
  ('name',    'Atlas Hotel'),
  ('tagline', 'Where Luxury Meets Comfort'),
  ('about',   'Atlas Hotel has been a beacon of luxury and hospitality since 1995. Nestled in the heart of the city, we offer an unparalleled experience that blends timeless elegance with modern comfort. Our dedicated team of professionals ensures every stay is memorable, every meal is exquisite, and every moment is crafted to perfection.'),
  ('address', '123 Luxury Avenue, Beverly Hills, CA 90210'),
  ('phone',   '+1 (555) 123-4567'),
  ('email',   'info@atlashotel.com')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM hotel_info);
```

## 4. Set Up Row-Level Security (RLS) — Optional

For a hotel admin backend, you can keep things simple without RLS. But if you want
to expose data directly to the frontend via the Supabase client library, enable RLS:

```sql
-- Enable RLS on all tables
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE events_tbl ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- Public read access policies (anon key)
CREATE POLICY "Public read rooms" ON rooms FOR SELECT USING (true);
CREATE POLICY "Public read services" ON services FOR SELECT USING (true);
CREATE POLICY "Public read events" ON events_tbl FOR SELECT USING (true);
CREATE POLICY "Public read offers" ON offers FOR SELECT USING (true);
CREATE POLICY "Public read menu" ON menu_items FOR SELECT USING (true);
CREATE POLICY "Public read gallery" ON gallery FOR SELECT USING (true);
CREATE POLICY "Public read testimonials" ON testimonials FOR SELECT USING (true);
CREATE POLICY "Public read hotel_info" ON hotel_info FOR SELECT USING (true);
```

## 5. Update `server.js` to Use Supabase

### 5a. Install the Supabase client

```bash
npm install @supabase/supabase-js
```

### 5b. Add environment variables

Create a `.env` file in the project root:

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
PORT=3000
```

Install dotenv:

```bash
npm install dotenv
```

### 5c. Refactor `server.js`

Replace the SQLite-based `initDb`, `createTables`, `seedData`, and `saveDb` with
a Supabase client. See the example below for the key changes:

```javascript
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Instead of db.exec(...), use supabase.from('table').select(...) etc.
//
// Example — get all rooms:
// const { data: rooms, error } = await supabase.from('rooms').select('*').order('price_per_night', { ascending: true });
//
// Example — insert a booking:
// const { data, error } = await supabase.from('bookings').insert({
//   booking_number: 'ABC001',
//   room_id: 1,
//   guest_name: 'John Doe',
//   guest_email: 'john@example.com',
//   check_in: '2026-07-01',
//   check_out: '2026-07-03',
//   guests: 2
// }).select().single();
```

### 5d. Key API method mapping

| SQLite (`db.exec`)               | Supabase                                      |
|----------------------------------|-----------------------------------------------|
| `db.exec('SELECT ...')`          | `await supabase.from('table').select(...)`    |
| `db.run('INSERT INTO ...')`      | `await supabase.from('table').insert(...)`    |
| `db.run('UPDATE ... WHERE id=?')`| `await supabase.from('table').update(...).eq('id', id)` |
| `db.run('DELETE ... WHERE id=?')`| `await supabase.from('table').delete().eq('id', id)`   |
| `saveDb()`                       | Not needed (Supabase persists automatically)  |
| `checkAvailability(...)`         | Query `bookings` table with Supabase filters  |

All route handlers (`app.get`, `app.post`, etc.) need to be converted from
synchronous `db.exec` calls to async `await supabase` calls.

## 6. File Uploads (Images)

SQLite stored image paths locally under `/uploads/`. With Supabase you have options:

**Option A — Keep using local `/uploads/` folder** (simplest, no changes needed).

**Option B — Use Supabase Storage:**

1. In Supabase dashboard, go to **Storage** → **Create bucket** → name it `uploads`.
2. Make it public (or set up RLS policies).
3. Upload files via `supabase.storage.from('uploads').upload(...)`.
4. Use the returned public URL in your database records.

## 7. Verify the Migration

1. Start your updated server: `npm start`
2. Hit `http://localhost:3000/api/rooms` — you should see the seed room data.
3. Test a booking creation via the frontend.
4. Check Supabase dashboard → **Table Editor** to confirm data is populated.

## 8. Going to Production

- Use the `service_role` key server-side only (never expose it to the client).
- Switch the frontend `anon` key for public-read-only operations if you use the Supabase JS client in the browser.
- Enable SSL (your Supabase project already has it).
- Set up proper connection pooling if you expect high traffic.

---

## Schema Diagram (Text)

```
rooms ──┐
         │
bookings ┤ (FK → rooms.id)
         │
booking_counter (standalone counter)
services (standalone)
events_tbl (standalone)
offers (standalone)
menu_items (standalone)
gallery (standalone)
testimonials (standalone)
admins (standalone)
settings (key-value)
hotel_info (key-value)
```
