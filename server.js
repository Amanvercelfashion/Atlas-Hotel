require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

async function uploadToSupabase(buffer, filename, mimetype) {
  const filePath = `uploads/${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(filename)}`;
  const { error } = await supabase.storage.from('uploads').upload(filePath, buffer, {
    contentType: mimetype,
    upsert: false,
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(filePath);
  return urlData.publicUrl;
}

async function generateBookingNumber() {
  const { data: counterData } = await supabase
    .from('booking_counter')
    .select('counter')
    .eq('id', 1)
    .single();

  let counter = (counterData?.counter || 0) + 1;

  await supabase
    .from('booking_counter')
    .update({ counter })
    .eq('id', 1);

  const letters1 = String.fromCharCode(65 + (counter % 26));
  const letters2 = String.fromCharCode(65 + (Math.floor(counter / 26) % 26));
  const letters3 = String.fromCharCode(65 + (Math.floor(counter / 676) % 26));
  const nums = String(counter).padStart(3, '0').slice(-3);
  return `${letters1}${letters2}${letters3}${nums}`;
}

async function checkAvailability(roomId, checkIn, checkOut, excludeBookingId = null) {
  const { data: roomData } = await supabase
    .from('rooms')
    .select('available_units')
    .eq('id', roomId)
    .single();

  if (!roomData) return false;
  const totalUnits = roomData.available_units;

  let query = supabase
    .from('bookings')
    .select('guests')
    .eq('room_id', roomId)
    .eq('status', 'confirmed')
    .lt('check_in', checkOut)
    .gt('check_out', checkIn);

  if (excludeBookingId) {
    query = query.neq('id', excludeBookingId);
  }

  const { data: bookings } = await query;
  const bookedGuests = (bookings || []).reduce((sum, b) => sum + b.guests, 0);
  return bookedGuests < totalUnits;
}

function parseAmenities(room) {
  if (room.amenities && typeof room.amenities === 'string') {
    try { room.amenities = JSON.parse(room.amenities); } catch { room.amenities = []; }
  }
  return room;
}

// Auth

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const { data: admins, error } = await supabase
    .from('admins')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !admins || !bcrypt.compareSync(password, admins.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({ success: true, token: Buffer.from(`${username}:${Date.now()}`).toString('base64'), username });
});

async function requireAdmin(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const decoded = Buffer.from(token, 'base64').toString('utf-8');
  const [username] = decoded.split(':');
  const { count, error } = await supabase
    .from('admins')
    .select('*', { count: 'exact', head: true })
    .eq('username', username);

  if (error || count === 0) return res.status(401).json({ error: 'Unauthorized' });
  req.adminUser = username;
  next();
}

// Hotel Info

app.get('/api/hotel-info', async (req, res) => {
  const { data, error } = await supabase.from('hotel_info').select('key, value');
  if (error) return res.status(500).json({ error: error.message });
  const info = {};
  (data || []).forEach(r => { info[r.key] = r.value; });
  res.json(info);
});

app.put('/api/hotel-info', requireAdmin, async (req, res) => {
  const { key, value } = req.body;
  const { error } = await supabase.from('hotel_info').upsert({ key, value }, { onConflict: 'key' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post('/api/hotel-info/logo', requireAdmin, upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Logo image required' });
  const url = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
  const { error } = await supabase.from('hotel_info').upsert({ key: 'logo', value: url }, { onConflict: 'key' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, url });
});

// Rooms

app.get('/api/rooms', async (req, res) => {
  const { data, error } = await supabase.from('rooms').select('*').order('price_per_night', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  (data || []).forEach(parseAmenities);
  res.json(data || []);
});

app.post('/api/rooms', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, description, amenities, price_per_night, available_units } = req.body;
  if (!name || !price_per_night) return res.status(400).json({ error: 'Name and price required' });
  const image = req.file ? await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype) : null;
  const { error } = await supabase.from('rooms').insert({
    name, description, amenities: amenities || '[]',
    price_per_night: parseFloat(price_per_night), available_units: parseInt(available_units) || 5, image
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put('/api/rooms/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, description, amenities, price_per_night, available_units } = req.body;
  const id = req.params.id;
  const updates = {
    name, description, amenities: amenities || '[]',
    price_per_night: parseFloat(price_per_night), available_units: parseInt(available_units) || 5,
    updated_at: new Date().toISOString()
  };
  if (req.file) {
    updates.image = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
  }
  const { error } = await supabase.from('rooms').update(updates).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/api/rooms/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase.from('rooms').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Bookings

app.post('/api/bookings', async (req, res) => {
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

  if (!await checkAvailability(room_id, check_in, check_out)) {
    return res.status(400).json({ error: 'Sorry, this room is not available for the selected dates.' });
  }

  const bookingNumber = await generateBookingNumber();

  const { error } = await supabase.from('bookings').insert({
    booking_number: bookingNumber, room_id, guest_name, guest_email,
    guest_phone: guest_phone || null, check_in, check_out,
    guests: parseInt(guests), special_requests: special_requests || null,
    status: 'confirmed'
  });

  if (error) return res.status(500).json({ error: error.message });

  sendConfirmationEmail(guest_email, guest_name, bookingNumber).catch(() => {});

  res.json({ success: true, booking_number: bookingNumber });
});

app.post('/api/bookings/lookup', async (req, res) => {
  const { email, booking_number } = req.body;
  const { data, error } = await supabase
    .from('bookings')
    .select('*, rooms(name)')
    .eq('guest_email', email)
    .eq('booking_number', booking_number)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Booking not found. Please check your email and booking number.' });
  }
  data.room_name = data.rooms?.name;
  delete data.rooms;
  res.json(data);
});

app.put('/api/bookings/:id', async (req, res) => {
  const { guest_name, guest_phone, check_in, check_out, guests, special_requests } = req.body;
  const id = req.params.id;

  const { data: current, error: fetchError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !current) return res.status(404).json({ error: 'Booking not found' });

  const newCheckIn = check_in || current.check_in;
  const newCheckOut = check_out || current.check_out;

  if (new Date(newCheckIn) < new Date(new Date().toDateString())) {
    return res.status(400).json({ error: 'Check-in date cannot be in the past' });
  }
  if (new Date(newCheckOut) <= new Date(newCheckIn)) {
    return res.status(400).json({ error: 'Check-out must be after check-in' });
  }

  if (!await checkAvailability(current.room_id, newCheckIn, newCheckOut, id)) {
    return res.status(400).json({ error: 'The room is not available for the updated dates.' });
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      guest_name: guest_name || current.guest_name,
      guest_phone: guest_phone !== undefined ? guest_phone : current.guest_phone,
      check_in: newCheckIn,
      check_out: newCheckOut,
      guests: parseInt(guests) || current.guests,
      special_requests: special_requests !== undefined ? special_requests : current.special_requests,
      status: 'amended',
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, message: 'Booking amended successfully.' });
});

app.delete('/api/bookings/:id', async (req, res) => {
  const { email, booking_number } = req.body;
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id')
    .eq('id', req.params.id)
    .eq('guest_email', email)
    .eq('booking_number', booking_number)
    .single();

  if (fetchError || !booking) {
    return res.status(404).json({ error: 'Booking not found or credentials do not match.' });
  }

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, message: 'Booking cancelled successfully.' });
});

app.get('/api/bookings/all', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, rooms(name)')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  (data || []).forEach(b => { b.room_name = b.rooms?.name; delete b.rooms; });
  res.json(data || []);
});

// Services

app.get('/api/services', async (req, res) => {
  const { data, error } = await supabase.from('services').select('*').order('id');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/services', requireAdmin, upload.single('icon'), async (req, res) => {
  const { name, description } = req.body;
  const icon = req.file ? await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype) : null;
  const { error } = await supabase.from('services').insert({ name, icon, description });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put('/api/services/:id', requireAdmin, upload.single('icon'), async (req, res) => {
  const { name, description } = req.body;
  const id = req.params.id;
  const updates = { name, description };
  if (req.file) {
    updates.icon = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
  }
  const { error } = await supabase.from('services').update(updates).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/api/services/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase.from('services').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Events

app.get('/api/events', async (req, res) => {
  const { data, error } = await supabase.from('events_tbl').select('*').order('id');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/events', requireAdmin, upload.single('image'), async (req, res) => {
  const { title, description } = req.body;
  const image = req.file ? await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype) : null;
  const { error } = await supabase.from('events_tbl').insert({ title, description, image });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put('/api/events/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const { title, description } = req.body;
  const id = req.params.id;
  const updates = { title, description };
  if (req.file) {
    updates.image = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
  }
  const { error } = await supabase.from('events_tbl').update(updates).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/api/events/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase.from('events_tbl').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Offers

app.get('/api/offers', async (req, res) => {
  const { data, error } = await supabase.from('offers').select('*').order('id');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/offers', requireAdmin, upload.single('image'), async (req, res) => {
  const { title, description } = req.body;
  const image = req.file ? await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype) : null;
  const { error } = await supabase.from('offers').insert({ title, description, image });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put('/api/offers/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const { title, description } = req.body;
  const id = req.params.id;
  const updates = { title, description };
  if (req.file) {
    updates.image = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
  }
  const { error } = await supabase.from('offers').update(updates).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/api/offers/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase.from('offers').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Menu

app.get('/api/menu', async (req, res) => {
  const { data, error } = await supabase.from('menu_items').select('*').order('id');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/menu', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, description } = req.body;
  const image = req.file ? await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype) : null;
  const { error } = await supabase.from('menu_items').insert({ name, description, image });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put('/api/menu/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, description } = req.body;
  const id = req.params.id;
  const updates = { name, description };
  if (req.file) {
    updates.image = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
  }
  const { error } = await supabase.from('menu_items').update(updates).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/api/menu/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase.from('menu_items').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Gallery

app.get('/api/gallery', async (req, res) => {
  const { data, error } = await supabase.from('gallery').select('*').order('id', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/gallery', requireAdmin, upload.single('image'), async (req, res) => {
  const { caption, section } = req.body;
  if (!req.file) return res.status(400).json({ error: 'Image required' });
  const image = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
  const { error } = await supabase.from('gallery').insert({ image, caption: caption || null, section: section || null });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/api/gallery/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase.from('gallery').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Testimonials

app.get('/api/testimonials', async (req, res) => {
  const { data, error } = await supabase.from('testimonials').select('*').order('id');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/testimonials', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, content } = req.body;
  const image = req.file ? await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype) : null;
  const { error } = await supabase.from('testimonials').insert({ name, content, image });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.put('/api/testimonials/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, content } = req.body;
  const id = req.params.id;
  const updates = { name, content };
  if (req.file) {
    updates.image = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
  }
  const { error } = await supabase.from('testimonials').update(updates).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/api/testimonials/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase.from('testimonials').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Admin & catch-all

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Email

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

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Atlas Hotel server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
