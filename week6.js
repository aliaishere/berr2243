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
    const uri = "mongodb://localhost:27017";
    const client = new MongoClient(uri);
    try {
        await client.connect();
        console.log("Connected to MongoDB");
        db = client.db("testDB");
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
    res.status(401).json({ error: "Invalid token" });
  }
};

// Middleware: Authorize roles
const authorize = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Forbidden (role not allowed)" });
  }
  next();
};


// --- JWT Middleware (optional for protected routes) ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Missing token" });

    jwt.verify(token, "secretkey", (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = user;
        next();
    });
}

// --- Register ---
const saltRounds = 10;

app.post('/users', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // hash the password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // create the user object with hashed password
    const user = {
      email,
      password: hashedPassword,
      role: role || "customer" 
    };

    await db.collection('users').insertOne(user);
    res.status(201).json({ message: "User created" });
  } catch (err) {
    res.status(400).json({ error: "Registration failed" });
  }
});

app.delete('/admin/users/:id', authenticate, authorize(['admin']), async (req, res) => {
  const id = req.params.id;

  try {
    const result = await db.collection('users').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(204).send(); // No content (success)
  } catch (err) {
    res.status(400).json({ error: "Invalid user ID" });
  }
});


// --- Login ---
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user
    const user = await db.collection('users').findOne({ email });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Compare password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ error: "Login error" });
  }
});


// --- Get All Rides ---
app.get('/rides', async (req, res) => {
    try {
        const rides = await db.collection('rides').find().toArray();
        res.status(200).json(rides);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch rides" });
    }
});

// --- Create a Ride ---
app.post('/rides', async (req, res) => {
    try {
        const result = await db.collection('rides').insertOne(req.body);
        res.status(201).json({ id: result.insertedId });
    } catch (err) {
        res.status(400).json({ error: "Invalid ride data" });
    }
});

// --- Update Ride Status ---
app.patch('/rides/:id', async (req, res) => {
    try {
        const result = await db.collection('rides').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { status: req.body.status } }
        );
        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: "Ride not found" });
        }
        res.status(200).json({ updated: result.modifiedCount });
    } catch (err) {
        res.status(400).json({ error: "Invalid ride ID or data" });
    }
});

// --- Delete Ride ---
app.delete('/rides/:id', async (req, res) => {
    try {
        const result = await db.collection('rides').deleteOne(
            { _id: new ObjectId(req.params.id) }
        );
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Ride not found" });
        }
        res.status(200).json({ deleted: result.deletedCount });
    } catch (err) {
        res.status(400).json({ error: "Invalid ride ID" });
    }
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});


