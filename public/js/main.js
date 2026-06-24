document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('nav-menu');
  const overlay = document.getElementById('overlay');

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
    overlay.classList.toggle('active');
    document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
  });

  function closeNav() {
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  overlay.addEventListener('click', closeNav);

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (!link.classList.contains('nav-popup')) closeNav();
    });
  });

  document.querySelectorAll('.nav-popup').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      closeNav();
      const popupId = link.dataset.popup;
      document.getElementById(`popup-${popupId}`).classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  document.querySelectorAll('.popup-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.popup-overlay').classList.remove('active');
      document.body.style.overflow = '';
    });
  });

  document.querySelectorAll('.popup-overlay').forEach(popup => {
    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        popup.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  });

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('booking-checkin').setAttribute('min', today);
  document.getElementById('booking-checkout').setAttribute('min', today);

  let roomsData = [];
  let currentBookingLookup = null;
  let testimonialIndex = 0;
  let testimonialInterval;

  async function loadHotelInfo() {
    try {
      const res = await fetch('/api/hotel-info');
      const info = await res.json();
      if (info.name) {
        document.querySelector('.hero-title').textContent = info.name;
        document.querySelector('.footer-logo').textContent = '\u2726 ' + info.name;
      }
      if (info.tagline) {
        document.querySelector('.hero-tagline').textContent = info.tagline;
        document.querySelector('.footer-content p').textContent = info.tagline;
      }
      if (info.about) document.getElementById('about-text').textContent = info.about;
      if (info.address) document.getElementById('contact-address').textContent = info.address;
      if (info.phone) {
        document.getElementById('contact-phone').textContent = info.phone;
        document.getElementById('contact-phone').href = `tel:${info.phone.replace(/[^+\d]/g, '')}`;
        document.querySelector('.btn-call').href = `tel:${info.phone.replace(/[^+\d]/g, '')}`;
      }
      if (info.email) {
        document.getElementById('contact-email').textContent = info.email;
        document.getElementById('contact-email').href = `mailto:${info.email}`;
      }
      if (info.logo) {
        const logoImg = document.getElementById('nav-logo-img');
        logoImg.src = info.logo;
        logoImg.style.display = 'inline';
        document.getElementById('nav-logo-text').style.display = 'none';
      }
    } catch (e) { console.error('Failed to load hotel info', e); }
  }

  async function loadRooms() {
    try {
      const res = await fetch('/api/rooms');
      roomsData = await res.json();
      const container = document.getElementById('rooms-container');
      const select = document.getElementById('booking-room-select');
      container.innerHTML = '';
      select.innerHTML = '<option value="">Select a room...</option>';

      roomsData.forEach(room => {
        const amenities = Array.isArray(room.amenities) ? room.amenities : (typeof room.amenities === 'string' ? JSON.parse(room.amenities) : []);
        const card = document.createElement('div');
        card.className = 'room-card';
        card.innerHTML = `
          <div class="room-img">
            <img src="${room.image || 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=600&q=80'}" alt="${room.name}" loading="lazy">
          </div>
          <div class="room-body">
            <h3>${room.name}</h3>
            <p class="room-desc">${room.description || ''}</p>
            <p class="room-price">$${room.price_per_night} <small>/ night</small></p>
            <div class="room-amenities">${amenities.map(a => `<span>${a}</span>`).join('')}</div>
            <button class="room-book-btn" data-room-id="${room.id}" data-room-name="${room.name}">Book This Room</button>
          </div>
        `;
        container.appendChild(card);

        const opt = document.createElement('option');
        opt.value = room.id;
        opt.textContent = `${room.name} - $${room.price_per_night}/night`;
        select.appendChild(opt);
      });

      document.querySelectorAll('.room-book-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const roomId = btn.dataset.roomId;
          document.getElementById('booking-room-select').value = roomId;
          document.getElementById('booking-room-id').value = roomId;
          document.getElementById('booking-form').scrollIntoView({ behavior: 'smooth' });
        });
      });
    } catch (e) { console.error('Failed to load rooms', e); }
  }

  async function loadServices() {
    try {
      const res = await fetch('/api/services');
      const services = await res.json();
      const container = document.getElementById('services-list');
      const icons = ['fa-wifi', 'fa-concierge-bell', 'fa-utensils', 'fa-cocktail', 'fa-dumbbell', 'fa-spa', 'fa-user-tie', 'fa-briefcase', 'fa-car', 'fa-parking'];
      container.innerHTML = services.map((s, i) => `
        <div class="service-item">
          <div class="service-icon">${s.icon ? `<img src="${s.icon}" alt="" style="width:20px;height:20px">` : `<i class="fas ${icons[i % icons.length]}"></i>`}</div>
          <span>${s.name}</span>
        </div>
      `).join('');
    } catch (e) { console.error('Failed to load services', e); }
  }

  async function loadEvents() {
    try {
      const res = await fetch('/api/events');
      const events = await res.json();
      const container = document.getElementById('events-list');
      container.innerHTML = events.map(e => `
        <div class="event-item">
          <h3>${e.title}</h3>
          <p>${e.description}</p>
        </div>
      `).join('');
    } catch (e) { console.error('Failed to load events', e); }
  }

  async function loadOffers() {
    try {
      const res = await fetch('/api/offers');
      const offers = await res.json();
      const container = document.getElementById('offers-list');
      container.innerHTML = offers.map(o => `
        <div class="offer-item">
          <h3>${o.title}</h3>
          <p>${o.description}</p>
        </div>
      `).join('');
    } catch (e) { console.error('Failed to load offers', e); }
  }

  async function loadGallery() {
    try {
      const res = await fetch('/api/gallery');
      const images = await res.json();
      const container = document.getElementById('gallery-grid');
      if (images.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;grid-column:1/-1">No images yet.</p>';
        return;
      }
      container.innerHTML = images.map(img => `
        <div class="gallery-item">
          <img src="${img.image || 'https://images.unsplash.com/photo-1562778612-e1e0cda9915c?w=400&q=80'}" alt="${img.caption || ''}" loading="lazy">
        </div>
      `).join('');
    } catch (e) { console.error('Failed to load gallery', e); }
  }

  async function loadMenu() {
    try {
      const res = await fetch('/api/menu');
      const items = await res.json();
      const container = document.getElementById('menu-container');
      container.innerHTML = items.map(item => `
        <div class="menu-item">
          <h4>${item.name}</h4>
          <p>${item.description}</p>
        </div>
      `).join('');
    } catch (e) { console.error('Failed to load menu', e); }
  }

  async function loadTestimonials() {
    try {
      const res = await fetch('/api/testimonials');
      const testimonials = await res.json();
      const container = document.getElementById('testimonial-carousel');
      container.innerHTML = `
        <div class="testimonial-inner">${testimonials.map((t, i) => `
          <div class="testimonial-card ${i === 0 ? 'active' : ''}" data-index="${i}">
            <div class="quote">"</div>
            <p>${t.content}</p>
            <div class="author">— ${t.name}</div>
          </div>
        `).join('')}</div>
        <div class="carousel-dots">${testimonials.map((_, i) => `
          <button class="carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></button>
        `).join('')}</div>
      `;

      const dots = container.querySelectorAll('.carousel-dot');
      const cards = container.querySelectorAll('.testimonial-card');

      dots.forEach(dot => {
        dot.addEventListener('click', () => {
          showTestimonial(parseInt(dot.dataset.index), cards, dots);
        });
      });

      if (testimonials.length > 1) {
        testimonialInterval = setInterval(() => {
          const next = (testimonialIndex + 1) % testimonials.length;
          showTestimonial(next, cards, dots);
        }, 5000);
      }
    } catch (e) { console.error('Failed to load testimonials', e); }
  }

  function showTestimonial(index, cards, dots) {
    testimonialIndex = index;
    cards.forEach((c, i) => c.classList.toggle('active', i === index));
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
    clearInterval(testimonialInterval);
    if (cards.length > 1) {
      testimonialInterval = setInterval(() => {
        const next = (testimonialIndex + 1) % cards.length;
        showTestimonial(next, cards, dots);
      }, 5000);
    }
  }

  document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('booking-message');
    msg.className = 'form-message';
    msg.style.display = 'none';

    const checkIn = document.getElementById('booking-checkin').value;
    const checkOut = document.getElementById('booking-checkout').value;

    if (new Date(checkIn) < new Date(today)) {
      msg.className = 'form-message error';
      msg.textContent = 'Check-in date cannot be in the past.';
      msg.style.display = 'block';
      return;
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      msg.className = 'form-message error';
      msg.textContent = 'Check-out must be after check-in.';
      msg.style.display = 'block';
      return;
    }

    const data = {
      room_id: document.getElementById('booking-room-select').value,
      guest_name: document.getElementById('booking-name').value,
      guest_email: document.getElementById('booking-email').value,
      guest_phone: document.getElementById('booking-phone').value,
      check_in: checkIn,
      check_out: checkOut,
      guests: document.getElementById('booking-guests').value,
      special_requests: document.getElementById('booking-requests').value
    };

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (res.ok) {
        msg.className = 'form-message success';
        msg.textContent = `Booking submitted. You will receive a confirmation email shortly. Booking Number: ${result.booking_number}`;
        msg.style.display = 'block';
        document.getElementById('booking-form').reset();
        document.getElementById('booking-checkin').setAttribute('min', today);
        document.getElementById('booking-checkout').setAttribute('min', today);
      } else {
        msg.className = 'form-message error';
        msg.textContent = result.error || 'Booking failed. Please try again.';
        msg.style.display = 'block';
      }
    } catch (err) {
      msg.className = 'form-message error';
      msg.textContent = 'Network error. Please try again.';
      msg.style.display = 'block';
    }
  });

  document.getElementById('booking-room-select').addEventListener('change', (e) => {
    document.getElementById('booking-room-id').value = e.target.value;
  });

  document.getElementById('booking-checkin').addEventListener('change', (e) => {
    const nextDay = new Date(e.target.value);
    nextDay.setDate(nextDay.getDate() + 1);
    document.getElementById('booking-checkout').setAttribute('min', nextDay.toISOString().split('T')[0]);
    if (document.getElementById('booking-checkout').value && document.getElementById('booking-checkout').value <= e.target.value) {
      document.getElementById('booking-checkout').value = '';
    }
  });

  document.getElementById('lookup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('lookup-message');
    const resultDiv = document.getElementById('lookup-result');
    msg.className = 'form-message';
    msg.style.display = 'none';
    resultDiv.classList.remove('active');

    const data = {
      email: document.getElementById('lookup-email').value,
      booking_number: document.getElementById('lookup-number').value
    };

    try {
      const res = await fetch('/api/bookings/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const booking = await res.json();
        currentBookingLookup = booking;
        displayBooking(booking);
      } else {
        const err = await res.json();
        msg.className = 'form-message error';
        msg.textContent = err.error || 'Booking not found.';
        msg.style.display = 'block';
      }
    } catch (err) {
      msg.className = 'form-message error';
      msg.textContent = 'Network error. Please try again.';
      msg.style.display = 'block';
    }
  });

  function displayBooking(booking) {
    const resultDiv = document.getElementById('lookup-result');
    resultDiv.innerHTML = `
      <div class="booking-detail">
        <p><strong>Booking #:</strong> ${booking.booking_number}</p>
        <p><strong>Room:</strong> ${booking.room_name || 'N/A'}</p>
        <p><strong>Name:</strong> ${booking.guest_name}</p>
        <p><strong>Email:</strong> ${booking.guest_email}</p>
        <p><strong>Phone:</strong> ${booking.guest_phone || 'N/A'}</p>
        <p><strong>Check-in:</strong> ${booking.check_in}</p>
        <p><strong>Check-out:</strong> ${booking.check_out}</p>
        <p><strong>Guests:</strong> ${booking.guests}</p>
        <p><strong>Requests:</strong> ${booking.special_requests || 'None'}</p>
        <p><strong>Status:</strong> ${booking.status}</p>
      </div>
      <div class="booking-actions">
        <button class="btn btn-secondary btn-sm" id="btn-amend-booking">Amend Booking</button>
        <button class="btn btn-danger btn-sm" id="btn-cancel-booking">Cancel Booking</button>
      </div>
      <div class="booking-edit-form" id="booking-edit-form">
        <h4 style="color:var(--gold);margin-bottom:12px">Amend Booking</h4>
        <form id="amend-form" style="display:flex;flex-direction:column;gap:12px">
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" id="amend-name" value="${booking.guest_name}">
          </div>
          <div class="form-group">
            <label>Phone</label>
            <input type="tel" id="amend-phone" value="${booking.guest_phone || ''}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Check-in</label>
              <input type="date" id="amend-checkin" value="${booking.check_in}" min="${today}">
            </div>
            <div class="form-group">
              <label>Check-out</label>
              <input type="date" id="amend-checkout" value="${booking.check_out}">
            </div>
          </div>
          <div class="form-group">
            <label>Guests</label>
            <input type="number" id="amend-guests" value="${booking.guests}" min="1" max="10">
          </div>
          <div class="form-group">
            <label>Special Requests</label>
            <textarea id="amend-requests" rows="3">${booking.special_requests || ''}</textarea>
          </div>
          <div style="display:flex;gap:8px">
            <button type="submit" class="btn btn-primary btn-sm">Save Changes</button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-amend">Cancel</button>
          </div>
          <div id="amend-message" class="form-message"></div>
        </form>
      </div>
    `;
    resultDiv.classList.add('active');

    document.getElementById('btn-cancel-booking').addEventListener('click', async () => {
      if (!confirm('Are you sure you want to cancel this booking?')) return;
      try {
        const res = await fetch(`/api/bookings/${booking.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: document.getElementById('lookup-email').value,
            booking_number: document.getElementById('lookup-number').value
          })
        });
        const result = await res.json();
        const msg = document.getElementById('lookup-message');
        if (res.ok) {
          msg.className = 'form-message success';
          msg.textContent = 'Booking cancelled successfully.';
          msg.style.display = 'block';
          displayBooking({ ...booking, status: 'cancelled' });
        } else {
          msg.className = 'form-message error';
          msg.textContent = result.error || 'Cancellation failed.';
          msg.style.display = 'block';
        }
      } catch (err) {
        const msg = document.getElementById('lookup-message');
        msg.className = 'form-message error';
        msg.textContent = 'Network error.';
        msg.style.display = 'block';
      }
    });

    document.getElementById('btn-amend-booking').addEventListener('click', () => {
      document.getElementById('booking-edit-form').classList.add('active');
    });

    document.getElementById('btn-cancel-amend').addEventListener('click', () => {
      document.getElementById('booking-edit-form').classList.remove('active');
    });

    document.getElementById('amend-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const amendMsg = document.getElementById('amend-message');
      amendMsg.className = 'form-message';
      amendMsg.style.display = 'none';

      const amendData = {
        guest_name: document.getElementById('amend-name').value,
        guest_phone: document.getElementById('amend-phone').value,
        check_in: document.getElementById('amend-checkin').value,
        check_out: document.getElementById('amend-checkout').value,
        guests: document.getElementById('amend-guests').value,
        special_requests: document.getElementById('amend-requests').value
      };

      if (new Date(amendData.check_in) < new Date(today)) {
        amendMsg.className = 'form-message error';
        amendMsg.textContent = 'Check-in date cannot be in the past.';
        amendMsg.style.display = 'block';
        return;
      }
      if (new Date(amendData.check_out) <= new Date(amendData.check_in)) {
        amendMsg.className = 'form-message error';
        amendMsg.textContent = 'Check-out must be after check-in.';
        amendMsg.style.display = 'block';
        return;
      }

      try {
        const res = await fetch(`/api/bookings/${booking.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(amendData)
        });
        const result = await res.json();
        if (res.ok) {
          amendMsg.className = 'form-message success';
          amendMsg.textContent = 'Booking amended successfully.';
          amendMsg.style.display = 'block';
          document.getElementById('booking-edit-form').classList.remove('active');
          const lookupRes = await fetch('/api/bookings/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: document.getElementById('lookup-email').value,
              booking_number: document.getElementById('lookup-number').value
            })
          });
          if (lookupRes.ok) {
            displayBooking(await lookupRes.json());
          }
        } else {
          amendMsg.className = 'form-message error';
          amendMsg.textContent = result.error || 'Amendment failed.';
          amendMsg.style.display = 'block';
        }
      } catch (err) {
        amendMsg.className = 'form-message error';
        amendMsg.textContent = 'Network error.';
        amendMsg.style.display = 'block';
      }
    });
  }

  loadHotelInfo();
  loadRooms();
  loadServices();
  loadEvents();
  loadOffers();
  loadGallery();
  loadMenu();
  loadTestimonials();
});
