import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("transport.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    name TEXT PRIMARY KEY,
    role TEXT,
    wallet_balance REAL DEFAULT 0,
    loyalty_points INTEGER DEFAULT 0,
    is_online BOOLEAN DEFAULT 0,
    documents_verified BOOLEAN DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    pickup_location TEXT,
    pickup_lat REAL,
    pickup_lng REAL,
    dropoff_location TEXT,
    dropoff_lat REAL,
    dropoff_lng REAL,
    vehicle_type TEXT,
    cargo_type TEXT,
    status TEXT DEFAULT 'pending',
    driver_id TEXT,
    driver_lat REAL,
    driver_lng REAL,
    price REAL,
    points_earned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;

  app.use(express.json());

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  // User Routes
  app.post("/api/users/login", (req, res, next) => {
    try {
      const { name, role } = req.body;
      let user = db.prepare("SELECT * FROM users WHERE name = ?").get(name);
      if (!user) {
        db.prepare("INSERT INTO users (name, role, wallet_balance, loyalty_points) VALUES (?, ?, ?, ?)")
          .run(name, role, 1000, 0); // Start with 1000 SAR for demo
        user = db.prepare("SELECT * FROM users WHERE name = ?").get(name);
      }
      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/users/:name", (req, res, next) => {
    try {
      const user = db.prepare("SELECT * FROM users WHERE name = ?").get(req.params.name);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/users/:name/wallet", (req, res, next) => {
    try {
      const { amount } = req.body;
      if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });
      db.prepare("UPDATE users SET wallet_balance = wallet_balance + ? WHERE name = ?").run(amount, req.params.name);
      const user = db.prepare("SELECT * FROM users WHERE name = ?").get(req.params.name);
      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  // API Routes
  app.get("/api/bookings", (req, res, next) => {
    try {
      const bookings = db.prepare("SELECT * FROM bookings ORDER BY created_at DESC").all();
      res.json(bookings);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/bookings", (req, res, next) => {
    try {
      const { id, customer_name, pickup_location, pickup_lat, pickup_lng, dropoff_location, dropoff_lat, dropoff_lng, vehicle_type, cargo_type, price } = req.body;
      
      // Deduct from wallet
      const user = db.prepare("SELECT * FROM users WHERE name = ?").get(customer_name) as any;
      if (!user || user.wallet_balance < price) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      
      db.prepare("UPDATE users SET wallet_balance = wallet_balance - ? WHERE name = ?").run(price, customer_name);
      
      const points = Math.floor(price / 10);
      const stmt = db.prepare(`
        INSERT INTO bookings (id, customer_name, pickup_location, pickup_lat, pickup_lng, dropoff_location, dropoff_lat, dropoff_lng, vehicle_type, cargo_type, price, points_earned)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, customer_name, pickup_location, pickup_lat, pickup_lng, dropoff_location, dropoff_lat, dropoff_lng, vehicle_type, cargo_type, price, points);
      
      const newBooking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(id);
      const updatedUser = db.prepare("SELECT * FROM users WHERE name = ?").get(customer_name);
      
      // Broadcast to all drivers
      io.emit("new_booking", newBooking);
      io.emit("user_updated", updatedUser);
      
      res.json(newBooking);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/bookings/:id/accept", (req, res, next) => {
    try {
      const { id } = req.params;
      const { driver_id } = req.body;
      
      const stmt = db.prepare("UPDATE bookings SET status = 'accepted', driver_id = ? WHERE id = ? AND status = 'pending'");
      const result = stmt.run(driver_id, id);
      
      if (result.changes > 0) {
        const updatedBooking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(id);
        io.emit("booking_updated", updatedBooking);
        res.json(updatedBooking);
      } else {
        res.status(400).json({ error: "Booking already accepted or not found" });
      }
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/bookings/:id/complete", (req, res, next) => {
    try {
      const { id } = req.params;
      
      const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(id) as any;
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      
      const stmt = db.prepare("UPDATE bookings SET status = 'completed' WHERE id = ? AND status = 'accepted'");
      const result = stmt.run(id);
      
      if (result.changes > 0) {
        // Pay driver
        db.prepare("UPDATE users SET wallet_balance = wallet_balance + ? WHERE name = ?").run(booking.price * 0.8, booking.driver_id);
        // Add points to customer
        db.prepare("UPDATE users SET loyalty_points = loyalty_points + ? WHERE name = ?").run(booking.points_earned, booking.customer_name);
        
        const updatedBooking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(id);
        const updatedCustomer = db.prepare("SELECT * FROM users WHERE name = ?").get(booking.customer_name);
        const updatedDriver = db.prepare("SELECT * FROM users WHERE name = ?").get(booking.driver_id);
        
        io.emit("booking_updated", updatedBooking);
        io.emit("user_updated", updatedCustomer);
        io.emit("user_updated", updatedDriver);
        
        res.json(updatedBooking);
      } else {
        res.status(400).json({ error: "Booking not found or not in accepted state" });
      }
    } catch (err) {
      next(err);
    }
  });

  // Admin Routes
  app.get("/api/admin/stats", (req, res, next) => {
    try {
      const totalBookings = (db.prepare("SELECT COUNT(*) as count FROM bookings").get() as any).count;
      const totalRevenue = (db.prepare("SELECT SUM(price) as sum FROM bookings WHERE status = 'completed'").get() as any).sum || 0;
      const activeDrivers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'driver' AND is_online = 1").get() as any).count;
      res.json({ totalBookings, totalRevenue, activeDrivers });
    } catch (err) {
      next(err);
    }
  });

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);
    
    socket.on("update_driver_location", ({ bookingId, lat, lng }) => {
      try {
        const stmt = db.prepare("UPDATE bookings SET driver_lat = ?, driver_lng = ? WHERE id = ?");
        stmt.run(lat, lng, bookingId);
        
        io.emit("driver_location_updated", { bookingId, lat, lng });
      } catch (err) {
        console.error("Socket error (update_driver_location):", err);
        socket.emit("error", { message: "Failed to update location" });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
