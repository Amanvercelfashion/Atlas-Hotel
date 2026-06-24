require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const initSqlJs = require('sql.js');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'hotel.db');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

async function uploadToSupabase(buffer, filename, mimetype) {
  const filePath = `uploads/${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(filename)}`;
  const { data, error } = await supabase.storage.from('uploads').upload(filePath, buffer, {
    contentType: mimetype,
    upsert: false,
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(filePath);
  return urlData.publicUrl;
}

let db;
let sql;

async function initDb() {
  sql = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new sql.Database(buffer);
  } else {
    db = new sql.Database();
  }
  db.run('PRAGMA journal_mode=WAL');
  createTables();
  seedData();
  saveDb();
}

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function createTables() {
  db.run(`CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    amenities TEXT,
    price_per_night REAL NOT NULL,
    available_units INTEGER DEFAULT 5,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_number TEXT UNIQUE NOT NULL,
    room_id INTEGER NOT NULL,
    guest_name TEXT NOT NULL,
    guest_email TEXT NOT NULL,
    guest_phone TEXT,
    check_in TEXT NOT NULL,
    check_out TEXT NOT NULL,
    guests INTEGER NOT NULL,
    special_requests TEXT,
    status TEXT DEFAULT 'confirmed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS booking_counter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    counter INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS events_tbl (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image TEXT NOT NULL,
    caption TEXT,
    section TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS hotel_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT
  )`);
}

async function seedData() {
  const adminCount = db.exec('SELECT COUNT(*) as c FROM admins');
  if (adminCount.length === 0 || adminCount[0].values[0][0] === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.run('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', hash]);
  }

  const counterExists = db.exec('SELECT COUNT(*) as c FROM booking_counter');
  if (counterExists[0].values[0][0] === 0) {
    db.run('INSERT INTO booking_counter (counter) VALUES (0)');
  }

  const roomCount = db.exec('SELECT COUNT(*) as c FROM rooms');
  if (roomCount[0].values[0][0] === 0) {
    const rooms = [
      { name: 'Standard Room', desc: 'Comfortable and elegant room with modern amenities. Perfect for solo travelers or couples.', amenities: '["5G WiFi","LED TV","Mini Bar","Room Service","Air Conditioning"]', price: 150, units: 10 },
      { name: 'Deluxe Room', desc: 'Spacious room with premium furnishings and stunning city views.', amenities: '["5G WiFi","LED TV","Mini Bar","Room Service","Air Conditioning","Bathtub","Turndown Service"]', price: 250, units: 8 },
      { name: 'Executive Suite', desc: 'Luxurious suite with separate living area, panoramic views, and VIP treatment.', amenities: '["5G WiFi","LED TV","Mini Bar","Room Service","Air Conditioning","Bathtub","Turndown Service","Gym Access","Lounge Access","Butler Service"]', price: 450, units: 5 },
      { name: 'Presidential Suite', desc: 'The pinnacle of luxury. Expansive space, private terrace, and personalized concierge service.', amenities: '["5G WiFi","LED TV","Mini Bar","Room Service","Air Conditioning","Bathtub","Turndown Service","Gym Access","Lounge Access","Butler Service","Private Terrace","Jacuzzi","Personal Concierge"]', price: 850, units: 2 }
    ];
    for (const r of rooms) {
      db.run('INSERT INTO rooms (name, description, amenities, price_per_night, available_units) VALUES (?, ?, ?, ?, ?)',
        [r.name, r.desc, r.amenities, r.price, r.units]);
    }
  }

  const servCount = db.exec('SELECT COUNT(*) as c FROM services');
  if (servCount[0].values[0][0] === 0) {
    const services = [
      '5G WiFi', '24hr Room Service', 'Restaurant & Bar', 'Mini Bar',
      'Gym & Fitness Center', 'Spa & Wellness', 'Concierge Service',
      'Laundry Service', 'Airport Transfer', 'Parking'
    ];
    for (const s of services) {
      db.run('INSERT INTO services (name, description) VALUES (?, ?)', [s, `Enjoy our premium ${s.toLowerCase()} service.`]);
    }
  }

  const eventCount = db.exec('SELECT COUNT(*) as c FROM events_tbl');
  if (eventCount[0].values[0][0] === 0) {
    const events = [
      { title: 'Wedding Celebrations', desc: 'Make your special day unforgettable with our elegant wedding venues, expert planning, and exceptional catering.' },
      { title: 'Corporate Events & Seminars', desc: 'Fully equipped conference halls with state-of-the-art technology for meetings, seminars, and corporate retreats.' },
      { title: 'Private Parties', desc: 'Celebrate birthdays, anniversaries, and milestones in style with our customizable party packages.' },
      { title: 'Gala Dinners', desc: 'Annual charity galas and formal dinner events held in our grand ballroom.' }
    ];
    for (const e of events) {
      db.run('INSERT INTO events_tbl (title, description) VALUES (?, ?)', [e.title, e.desc]);
    }
  }

  const offerCount = db.exec('SELECT COUNT(*) as c FROM offers');
  if (offerCount[0].values[0][0] === 0) {
    const offers = [
      { title: 'Stay 3 Pay 2', desc: 'Book 3 nights and pay for only 2! Available on Standard and Deluxe rooms.' },
      { title: 'Book Direct 5% Off', desc: 'Book directly through our website and save 5% on your total stay.' },
      { title: 'Summer Escape', desc: 'Enjoy 15% off on Executive Suites this summer season.' },
      { title: 'Honeymoon Package', desc: 'Romantic getaway with champagne, spa session, and late checkout.' }
    ];
    for (const o of offers) {
      db.run('INSERT INTO offers (title, description) VALUES (?, ?)', [o.title, o.desc]);
    }
  }

  const menuCount = db.exec('SELECT COUNT(*) as c FROM menu_items');
  if (menuCount[0].values[0][0] === 0) {
    const items = [
      { name: 'Grilled Atlantic Salmon', desc: 'Fresh salmon fillet with lemon butter sauce, seasonal vegetables, and herb-roasted potatoes.' },
      { name: 'Wagyu Beef Steak', desc: 'Premium Japanese Wagyu cooked to perfection, served with truffle mash and red wine jus.' },
      { name: 'Caesar Salad', desc: 'Crisp romaine lettuce, parmesan, croutons, and our signature house-made dressing.' },
      { name: 'Tiramisu', desc: 'Classic Italian dessert with espresso-soaked ladyfingers and mascarpone cream.' },
      { name: 'Signature Cocktails', desc: 'Handcrafted cocktails by our award-winning mixologists using premium spirits.' }
    ];
    for (const m of items) {
      db.run('INSERT INTO menu_items (name, description) VALUES (?, ?)', [m.name, m.desc]);
    }
  }

  const testCount = db.exec('SELECT COUNT(*) as c FROM testimonials');
  if (testCount[0].values[0][0] === 0) {
    const testimonials = [
      { name: 'Sarah M.', content: 'An absolutely stunning experience from check-in to check-out. The staff went above and beyond to make our anniversary special.' },
      { name: 'James K.', content: 'The Presidential Suite was breathtaking. Best hotel experience we have ever had. Will definitely return!' },
      { name: 'Maria L.', content: 'Excellent business facilities combined with luxury comfort. The conference team was incredibly professional.' },
      { name: 'David R.', content: 'The restaurant is world-class. We dined there every night of our stay and every dish was perfection.' }
    ];
    for (const t of testimonials) {
      db.run('INSERT INTO testimonials (name, content) VALUES (?, ?)', [t.name, t.content]);
    }
  }

  const infoCount = db.exec('SELECT COUNT(*) as c FROM hotel_info');
  if (infoCount[0].values[0][0] === 0) {
    const info = [
      { key: 'name', value: 'Atlas Hotel' },
      { key: 'tagline', value: 'Where Luxury Meets Comfort' },
      { key: 'about', value: 'Atlas Hotel has been a beacon of luxury and hospitality since 1995. Nestled in the heart of the city, we offer an unparalleled experience that blends timeless elegance with modern comfort. Our dedicated team of professionals ensures every stay is memorable, every meal is exquisite, and every moment is crafted to perfection.' },
      { key: 'address', value: '123 Luxury Avenue, Beverly Hills, CA 90210' },
      { key: 'phone', value: '+1 (555) 123-4567' },
      { key: 'email', value: 'info@atlashotel.com' }
    ];
    for (const i of info) {
      db.run('INSERT INTO hotel_info (key, value) VALUES (?, ?)', [i.key, i.value]);
    }
  }

  saveDb();
}

function generateBookingNumber() {
  const result = db.exec('SELECT counter FROM booking_counter WHERE id = 1');
  let counter = result[0].values[0][0];
  counter++;
  db.run('UPDATE booking_counter SET counter = ? WHERE id = 1', [counter]);
  const letters1 = String.fromCharCode(65 + (counter % 26));
  const letters2 = String.fromCharCode(65 + (Math.floor(counter / 26) % 26));
  const letters3 = String.fromCharCode(65 + (Math.floor(counter / 676) % 26));
  const nums = String(counter).padStart(3, '0').slice(-3);
  return `${letters1}${letters2}${letters3}${nums}`;
}

function checkAvailability(roomId, checkIn, checkOut, excludeBookingId = null) {
  const roomResult = db.exec('SELECT available_units FROM rooms WHERE id = ?', [roomId]);
  if (roomResult.length === 0) return false;
  const totalUnits = roomResult[0].values[0][0];

  let query = 'SELECT COALESCE(SUM(guests), 0) FROM bookings WHERE room_id = ? AND status = ? AND check_out > ? AND check_in < ?';
  const params = [roomId, 'confirmed', checkIn, checkOut];

  if (excludeBookingId) {
    query += ' AND id != ?';
    params.push(excludeBookingId);
  }

  const bookedResult = db.exec(query, params);
  const bookedGuests = bookedResult[0].values[0][0];

  return bookedGuests < totalUnits;
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const result = db.exec('SELECT * FROM admins WHERE username = ?', [username]);
  if (result.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

  const row = result[0].values[0];
  const hash = row[2];
  if (!bcrypt.compareSync(password, hash)) return res.status(401).json({ error: 'Invalid credentials' });

  res.json({ success: true, token: Buffer.from(`${username}:${Date.now()}`).toString('base64'), username });
});

function requireAdmin(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const decoded = Buffer.from(token, 'base64').toString('utf-8');
  const [username] = decoded.split(':');
  const result = db.exec('SELECT COUNT(*) as c FROM admins WHERE username = ?', [username]);
  if (result[0].values[0][0] === 0) return res.status(401).json({ error: 'Unauthorized' });
  req.adminUser = username;
  next();
}

app.get('/api/hotel-info', (req, res) => {
  const result = db.exec('SELECT key, value FROM hotel_info');
  const info = {};
  for (const row of result[0].values) {
    info[row[0]] = row[1];
  }
  res.json(info);
});

app.put('/api/hotel-info', requireAdmin, (req, res) => {
  const { key, value } = req.body;
  db.run('INSERT OR REPLACE INTO hotel_info (id, key, value) VALUES ((SELECT id FROM hotel_info WHERE key = ?), ?, ?)', [key, key, value]);
  saveDb();
  res.json({ success: true });
});

app.get('/api/rooms', (req, res) => {
  const result = db.exec('SELECT * FROM rooms ORDER BY price_per_night ASC');
  const rows = result[0] ? result[0].values : [];
  const columns = result[0] ? result[0].columns : [];
  const rooms = rows.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    if (obj.amenities && typeof obj.amenities === 'string') {
      try { obj.amenities = JSON.parse(obj.amenities); } catch (e) { obj.amenities = []; }
    }
    return obj;
  });
  res.json(rooms);
});

app.post('/api/rooms', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, description, amenities, price_per_night, available_units } = req.body;
  if (!name || !price_per_night) return res.status(400).json({ error: 'Name and price required' });
  const image = req.file ? await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype) : null;
  const amenitiesStr = amenities || '[]';
  db.run('INSERT INTO rooms (name, description, amenities, price_per_night, available_units, image) VALUES (?, ?, ?, ?, ?, ?)',
    [name, description, amenitiesStr, parseFloat(price_per_night), parseInt(available_units) || 5, image]);
  saveDb();
  res.json({ success: true });
});

app.put('/api/rooms/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, description, amenities, price_per_night, available_units } = req.body;
  const id = req.params.id;
  if (req.file) {
    const image = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
    db.run('UPDATE rooms SET name=?, description=?, amenities=?, price_per_night=?, available_units=?, image=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [name, description, amenities || '[]', parseFloat(price_per_night), parseInt(available_units) || 5, image, id]);
  } else {
    db.run('UPDATE rooms SET name=?, description=?, amenities=?, price_per_night=?, available_units=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [name, description, amenities || '[]', parseFloat(price_per_night), parseInt(available_units) || 5, id]);
  }
  saveDb();
  res.json({ success: true });
});

app.delete('/api/rooms/:id', requireAdmin, (req, res) => {
  db.run('DELETE FROM rooms WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

app.post('/api/bookings', (req, res) => {
  const { room_id, guest_name, guest_email, guest_phone, check_in, check_out, guests, special_requests } = req.body;
  if (!room_id || !guest_name || !guest_email || !check_in || !check_out || !guests) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (new Date(check_in) < new Date(new Date().toDateString())) {
    return res.status(400).json({ error: 'Check-in date cannot be in the past' });
  }
  if (new Date(check_out) <= new Date(check_in)) {
    return res.status(400).json({ error: 'Check-out must be after check-in' });
  }

  if (!checkAvailability(room_id, check_in, check_out)) {
    return res.status(400).json({ error: 'Sorry, this room is not available for the selected dates.' });
  }

  const bookingNumber = generateBookingNumber();
  db.run('INSERT INTO bookings (booking_number, room_id, guest_name, guest_email, guest_phone, check_in, check_out, guests, special_requests, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [bookingNumber, room_id, guest_name, guest_email, guest_phone || null, check_in, check_out, parseInt(guests), special_requests || null, 'confirmed']);
  saveDb();

  try {
    sendConfirmationEmail(guest_email, guest_name, bookingNumber);
  } catch (e) {
    console.log('Email sending failed:', e.message);
  }

  res.json({ success: true, booking_number: bookingNumber });
});

app.post('/api/bookings/lookup', (req, res) => {
  const { email, booking_number } = req.body;
  const result = db.exec('SELECT b.*, r.name as room_name FROM bookings b JOIN rooms r ON b.room_id = r.id WHERE b.guest_email = ? AND b.booking_number = ?',
    [email, booking_number]);
  if (result.length === 0 || result[0].values.length === 0) {
    return res.status(404).json({ error: 'Booking not found. Please check your email and booking number.' });
  }
  const columns = result[0].columns;
  const row = result[0].values[0];
  const booking = {};
  columns.forEach((col, i) => { booking[col] = row[i]; });
  res.json(booking);
});

app.put('/api/bookings/:id', (req, res) => {
  const { guest_name, guest_phone, check_in, check_out, guests, special_requests } = req.body;
  const id = req.params.id;

  const currentResult = db.exec('SELECT * FROM bookings WHERE id = ?', [id]);
  if (currentResult.length === 0 || currentResult[0].values.length === 0) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const currCols = currentResult[0].columns;
  const currRow = currentResult[0].values[0];
  const current = {};
  currCols.forEach((col, i) => { current[col] = currRow[i]; });

  const newCheckIn = check_in || current.check_in;
  const newCheckOut = check_out || current.check_out;

  if (new Date(newCheckIn) < new Date(new Date().toDateString())) {
    return res.status(400).json({ error: 'Check-in date cannot be in the past' });
  }
  if (new Date(newCheckOut) <= new Date(newCheckIn)) {
    return res.status(400).json({ error: 'Check-out must be after check-in' });
  }

  if (!checkAvailability(current.room_id, newCheckIn, newCheckOut, id)) {
    return res.status(400).json({ error: 'The room is not available for the updated dates.' });
  }

  db.run(`UPDATE bookings SET guest_name=?, guest_phone=?, check_in=?, check_out=?, guests=?, special_requests=?, status='amended', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [guest_name || current.guest_name, guest_phone !== undefined ? guest_phone : current.guest_phone,
    newCheckIn, newCheckOut, parseInt(guests) || current.guests, special_requests !== undefined ? special_requests : current.special_requests, id]);
  saveDb();
  res.json({ success: true, message: 'Booking amended successfully.' });
});

app.delete('/api/bookings/:id', (req, res) => {
  const { email, booking_number } = req.body;
  const result = db.exec('SELECT * FROM bookings WHERE id = ? AND guest_email = ? AND booking_number = ?', [req.params.id, email, booking_number]);
  if (result.length === 0 || result[0].values.length === 0) {
    return res.status(404).json({ error: 'Booking not found or credentials do not match.' });
  }
  db.run("UPDATE bookings SET status='cancelled' WHERE id = ?", [req.params.id]);
  saveDb();
  res.json({ success: true, message: 'Booking cancelled successfully.' });
});

app.get('/api/bookings/all', requireAdmin, (req, res) => {
  const result = db.exec('SELECT b.*, r.name as room_name FROM bookings b JOIN rooms r ON b.room_id = r.id ORDER BY b.created_at DESC');
  if (result.length === 0) return res.json([]);
  const columns = result[0].columns;
  const bookings = result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
  res.json(bookings);
});

app.get('/api/services', (req, res) => {
  const result = db.exec('SELECT * FROM services ORDER BY id ASC');
  if (result.length === 0) return res.json([]);
  const columns = result[0].columns;
  const items = result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
  res.json(items);
});

app.post('/api/services', requireAdmin, upload.single('icon'), async (req, res) => {
  const { name, description } = req.body;
  const icon = req.file ? await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype) : null;
  db.run('INSERT INTO services (name, icon, description) VALUES (?, ?, ?)', [name, icon, description]);
  saveDb();
  res.json({ success: true });
});

app.put('/api/services/:id', requireAdmin, upload.single('icon'), async (req, res) => {
  const { name, description } = req.body;
  const id = req.params.id;
  if (req.file) {
    const icon = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
    db.run('UPDATE services SET name=?, icon=?, description=? WHERE id=?', [name, icon, description, id]);
  } else {
    db.run('UPDATE services SET name=?, description=? WHERE id=?', [name, description, id]);
  }
  saveDb();
  res.json({ success: true });
});

app.delete('/api/services/:id', requireAdmin, (req, res) => {
  db.run('DELETE FROM services WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

app.get('/api/events', (req, res) => {
  const result = db.exec('SELECT * FROM events_tbl ORDER BY id ASC');
  if (result.length === 0) return res.json([]);
  const columns = result[0].columns;
  const items = result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
  res.json(items);
});

app.post('/api/events', requireAdmin, upload.single('image'), async (req, res) => {
  const { title, description } = req.body;
  const image = req.file ? await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype) : null;
  db.run('INSERT INTO events_tbl (title, description, image) VALUES (?, ?, ?)', [title, description, image]);
  saveDb();
  res.json({ success: true });
});

app.put('/api/events/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const { title, description } = req.body;
  const id = req.params.id;
  if (req.file) {
    const image = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
    db.run('UPDATE events_tbl SET title=?, description=?, image=? WHERE id=?', [title, description, image, id]);
  } else {
    db.run('UPDATE events_tbl SET title=?, description=? WHERE id=?', [title, description, id]);
  }
  saveDb();
  res.json({ success: true });
});

app.delete('/api/events/:id', requireAdmin, (req, res) => {
  db.run('DELETE FROM events_tbl WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

app.get('/api/offers', (req, res) => {
  const result = db.exec('SELECT * FROM offers ORDER BY id ASC');
  if (result.length === 0) return res.json([]);
  const columns = result[0].columns;
  const items = result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
  res.json(items);
});

app.post('/api/offers', requireAdmin, upload.single('image'), async (req, res) => {
  const { title, description } = req.body;
  const image = req.file ? await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype) : null;
  db.run('INSERT INTO offers (title, description, image) VALUES (?, ?, ?)', [title, description, image]);
  saveDb();
  res.json({ success: true });
});

app.put('/api/offers/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const { title, description } = req.body;
  const id = req.params.id;
  if (req.file) {
    const image = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
    db.run('UPDATE offers SET title=?, description=?, image=? WHERE id=?', [title, description, image, id]);
  } else {
    db.run('UPDATE offers SET title=?, description=? WHERE id=?', [title, description, id]);
  }
  saveDb();
  res.json({ success: true });
});

app.delete('/api/offers/:id', requireAdmin, (req, res) => {
  db.run('DELETE FROM offers WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

app.get('/api/menu', (req, res) => {
  const result = db.exec('SELECT * FROM menu_items ORDER BY id ASC');
  if (result.length === 0) return res.json([]);
  const columns = result[0].columns;
  const items = result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
  res.json(items);
});

app.post('/api/menu', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, description } = req.body;
  const image = req.file ? await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype) : null;
  db.run('INSERT INTO menu_items (name, description, image) VALUES (?, ?, ?)', [name, description, image]);
  saveDb();
  res.json({ success: true });
});

app.put('/api/menu/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, description } = req.body;
  const id = req.params.id;
  if (req.file) {
    const image = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
    db.run('UPDATE menu_items SET name=?, description=?, image=? WHERE id=?', [name, description, image, id]);
  } else {
    db.run('UPDATE menu_items SET name=?, description=? WHERE id=?', [name, description, id]);
  }
  saveDb();
  res.json({ success: true });
});

app.delete('/api/menu/:id', requireAdmin, (req, res) => {
  db.run('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

app.get('/api/gallery', (req, res) => {
  const result = db.exec('SELECT * FROM gallery ORDER BY id DESC');
  if (result.length === 0) return res.json([]);
  const columns = result[0].columns;
  const items = result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
  res.json(items);
});

app.post('/api/gallery', requireAdmin, upload.single('image'), async (req, res) => {
  const { caption, section } = req.body;
  if (!req.file) return res.status(400).json({ error: 'Image required' });
  const image = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
  db.run('INSERT INTO gallery (image, caption, section) VALUES (?, ?, ?)', [image, caption || null, section || null]);
  saveDb();
  res.json({ success: true });
});

app.delete('/api/gallery/:id', requireAdmin, (req, res) => {
  db.run('DELETE FROM gallery WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

app.get('/api/testimonials', (req, res) => {
  const result = db.exec('SELECT * FROM testimonials ORDER BY id ASC');
  if (result.length === 0) return res.json([]);
  const columns = result[0].columns;
  const items = result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
  res.json(items);
});

app.post('/api/testimonials', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, content } = req.body;
  const image = req.file ? await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype) : null;
  db.run('INSERT INTO testimonials (name, content, image) VALUES (?, ?, ?)', [name, content, image]);
  saveDb();
  res.json({ success: true });
});

app.put('/api/testimonials/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, content } = req.body;
  const id = req.params.id;
  if (req.file) {
    const image = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
    db.run('UPDATE testimonials SET name=?, content=?, image=? WHERE id=?', [name, content, image, id]);
  } else {
    db.run('UPDATE testimonials SET name=?, content=? WHERE id=?', [name, content, id]);
  }
  saveDb();
  res.json({ success: true });
});

app.delete('/api/testimonials/:id', requireAdmin, (req, res) => {
  db.run('DELETE FROM testimonials WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ success: true });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function sendConfirmationEmail(to, name, bookingNumber) {
  try {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
    const info = await transporter.sendMail({
      from: '"Atlas Hotel" <booking@atlashotel.com>',
      to,
      subject: 'Booking Confirmation - Atlas Hotel',
      html: `<div style="font-family:Arial;max-width:600px;margin:auto;padding:20px;border:1px solid #ddd;border-radius:8px;">
        <h2 style="color:#c9a84c;">Atlas Hotel</h2>
        <p>Dear ${name},</p>
        <p>Thank you for your booking! Your reservation has been confirmed.</p>
        <p><strong>Booking Number:</strong> ${bookingNumber}</p>
        <p>Please keep this number for any amendments or cancellations.</p>
        <p>To amend or cancel your booking, visit our website and use the "My Bookings" feature with your email and booking number.</p>
        <p>We look forward to welcoming you!</p>
        <p style="color:#666;font-size:12px;">Atlas Hotel Team</p>
      </div>`
    });
    console.log('Confirmation email sent:', nodemailer.getTestMessageUrl(info));
  } catch (e) {
    console.log('Email service not available:', e.message);
  }
}

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Atlas Hotel server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
