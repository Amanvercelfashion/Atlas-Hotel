-- Atlas Hotel — Supabase Schema Migration

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

-- Booking counter
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

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  key TEXT UNIQUE NOT NULL,
  value TEXT
);

-- Hotel Info
CREATE TABLE IF NOT EXISTS hotel_info (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  key TEXT UNIQUE NOT NULL,
  value TEXT
);

-- Seed Data

INSERT INTO admins (username, password)
SELECT 'admin', '$2a$10$dCpmQgiZT1bHKACoti0k.e7fXVLueMXTyfkujhu2viymCVpyL5jq6'
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE username = 'admin');

INSERT INTO booking_counter (counter)
SELECT 0
WHERE NOT EXISTS (SELECT 1 FROM booking_counter);

INSERT INTO rooms (name, description, amenities, price_per_night, available_units)
SELECT * FROM (VALUES
  ('Standard Room',    'Comfortable and elegant room with modern amenities. Perfect for solo travelers or couples.',   '["5G WiFi","LED TV","Mini Bar","Room Service","Air Conditioning"]',                              150, 10),
  ('Deluxe Room',      'Spacious room with premium furnishings and stunning city views.',                              '["5G WiFi","LED TV","Mini Bar","Room Service","Air Conditioning","Bathtub","Turndown Service"]',     250, 8),
  ('Executive Suite',  'Luxurious suite with separate living area, panoramic views, and VIP treatment.',               '["5G WiFi","LED TV","Mini Bar","Room Service","Air Conditioning","Bathtub","Turndown Service","Gym Access","Lounge Access","Butler Service"]', 450, 5),
  ('Presidential Suite','The pinnacle of luxury. Expansive space, private terrace, and personalized concierge service.','["5G WiFi","LED TV","Mini Bar","Room Service","Air Conditioning","Bathtub","Turndown Service","Gym Access","Lounge Access","Butler Service","Private Terrace","Jacuzzi","Personal Concierge"]', 850, 2)
) AS v
WHERE NOT EXISTS (SELECT 1 FROM rooms);

INSERT INTO services (name, description)
SELECT * FROM (VALUES
  ('5G WiFi',             'Enjoy our premium 5G wifi service.'),
  ('24hr Room Service',   'Enjoy our premium 24hr room service.'),
  ('Restaurant & Bar',    'Enjoy our premium restaurant & bar service.'),
  ('Mini Bar',            'Enjoy our premium mini bar service.'),
  ('Gym & Fitness Center','Enjoy our premium gym & fitness center service.'),
  ('Spa & Wellness',      'Enjoy our premium spa & wellness service.'),
  ('Concierge Service',   'Enjoy our premium concierge service.'),
  ('Laundry Service',     'Enjoy our premium laundry service.'),
  ('Airport Transfer',    'Enjoy our premium airport transfer service.'),
  ('Parking',             'Enjoy our premium parking service.')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM services);

INSERT INTO events_tbl (title, description)
SELECT * FROM (VALUES
  ('Wedding Celebrations',      'Make your special day unforgettable with our elegant wedding venues, expert planning, and exceptional catering.'),
  ('Corporate Events & Seminars','Fully equipped conference halls with state-of-the-art technology for meetings, seminars, and corporate retreats.'),
  ('Private Parties',           'Celebrate birthdays, anniversaries, and milestones in style with our customizable party packages.'),
  ('Gala Dinners',              'Annual charity galas and formal dinner events held in our grand ballroom.')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM events_tbl);

INSERT INTO offers (title, description)
SELECT * FROM (VALUES
  ('Stay 3 Pay 2',       'Book 3 nights and pay for only 2! Available on Standard and Deluxe rooms.'),
  ('Book Direct 5% Off', 'Book directly through our website and save 5% on your total stay.'),
  ('Summer Escape',      'Enjoy 15% off on Executive Suites this summer season.'),
  ('Honeymoon Package',  'Romantic getaway with champagne, spa session, and late checkout.')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM offers);

INSERT INTO menu_items (name, description)
SELECT * FROM (VALUES
  ('Grilled Atlantic Salmon', 'Fresh salmon fillet with lemon butter sauce, seasonal vegetables, and herb-roasted potatoes.'),
  ('Wagyu Beef Steak',        'Premium Japanese Wagyu cooked to perfection, served with truffle mash and red wine jus.'),
  ('Caesar Salad',            'Crisp romaine lettuce, parmesan, croutons, and our signature house-made dressing.'),
  ('Tiramisu',                'Classic Italian dessert with espresso-soaked ladyfingers and mascarpone cream.'),
  ('Signature Cocktails',     'Handcrafted cocktails by our award-winning mixologists using premium spirits.')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM menu_items);

INSERT INTO testimonials (name, content)
SELECT * FROM (VALUES
  ('Sarah M.', 'An absolutely stunning experience from check-in to check-out. The staff went above and beyond to make our anniversary special.'),
  ('James K.', 'The Presidential Suite was breathtaking. Best hotel experience we have ever had. Will definitely return!'),
  ('Maria L.', 'Excellent business facilities combined with luxury comfort. The conference team was incredibly professional.'),
  ('David R.', 'The restaurant is world-class. We dined there every night of our stay and every dish was perfection.')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM testimonials);

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
