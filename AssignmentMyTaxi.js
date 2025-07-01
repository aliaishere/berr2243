require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
const port = 3000;

let db;

// --- Connect to MongoDB ---
async function connectToMongoDB() {
    const uri = process.env.MONGO_URI;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        console.log("Connected to MongoDB Atlas");
        db = client.db("MyTaxi");
    } catch (err) {
        console.error("MongoDB connection error:", err);
    }
}
connectToMongoDB();

// Middleware: Authenticate JWT
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; 
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid Token" });
  }
};

// Middleware: Authorize roles
const authorize = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Forbidden (role not allowed)" });
  }
  next();
};


// --- Register ---
app.post('/users', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user object
    const user = { email, password: hashedPassword, role };

    // Insert into MongoDB
    const result = await db.collection('users').insertOne(user);

    console.log("User inserted with ID:", result.insertedId);
    res.status(201).json({ userId: result.insertedId });
  } catch (err) {
    console.error("Registration error:", err.message);
    res.status(500).json({ error: "Registration failed", reason: err.message });
  }
});

// --- Login ---
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.collection('users').findOne({ email });
    if (!user) return res.status(401).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Incorrect password" });

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ error: "Login error" });
  }
});

// --- Admin: Delete any user ---
app.delete('/admin/users/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const result = await db.collection('users').deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) return res.status(404).json({ error: "User not found" });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: "Invalid user ID" });
  }
});

// --- Passenger: Request Ride ---
app.post('/rides', authenticate, authorize(['passenger']), async (req, res) => {
  try {
    const { pickup, destination } = req.body;
    const ride = {
      pickup,
      destination,
      passengerId: req.user.userId,
      status: 'requested'
    };
    const result = await db.collection('rides').insertOne(ride);
    res.status(201).json({ rideId: result.insertedId });
  } catch (err) {
    res.status(400).json({ error: "Invalid ride data" });
  }
});

// --- Driver: Accept or Complete Ride ---
app.patch('/rides/:id', authenticate, authorize(['driver']), async (req, res) => {
  try {
    const result = await db.collection('rides').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: req.body.status, driverId: req.user.userId } }
    );
    if (result.modifiedCount === 0) return res.status(404).json({ error: "Ride not found" });
    res.status(200).json({ updated: result.modifiedCount });
  } catch (err) {
    res.status(400).json({ error: "Invalid ride ID or data" });
  }
});

// --- Admin: View All Rides ---
app.get('/rides', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const rides = await db.collection('rides').find().toArray();
    res.status(200).json(rides);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch rides" });
  }
});

// --- Admin: Manage users account ---
app.delete('admin/users/:id', authenticate, async (req, res) => {
  const result = await db.collection('users').deleteOne({ _id: new ObjectId(req.user.userId) });
  res.status(200).json({ deleted: result.deletedCount });
});


// --- Driver/Passenger: Delete own account ---
app.delete('/users/me', authenticate, async (req, res) => {
  const result = await db.collection('users').deleteOne({ _id: new ObjectId(req.user.userId) });
  res.status(200).json({ deleted: result.deletedCount });
});

// --- Driver/Passenger: Update profile ---
app.patch('/users/me', authenticate, async (req, res) => {
  const updates = req.body;
  const result = await db.collection('users').updateOne(
    { _id: new ObjectId(req.user.userId) },
    { $set: updates }
  );
  res.status(200).json({ updated: result.modifiedCount });
});

// --- View passengers (for driver) ---
app.get('/driver/passengers', authenticate, authorize(['driver']), async (req, res) => {
  const passengers = await db.collection('users').find({ role: 'passenger' }).toArray();
  res.status(200).json(passengers);
});

// --- View drivers (for passenger) ---
app.get('/passenger/drivers', authenticate, authorize(['passenger']), async (req, res) => {
  const drivers = await db.collection('users').find({ role: 'driver' }).toArray();
  res.status(200).json(drivers);
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});