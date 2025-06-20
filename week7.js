const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Middleware
app.use(express.json());

// Aggregation Endpoint
app.get('/analytics/passengers', async (req, res) => {
  try {
    const result = await db.collection('users').aggregate([
      {
        $lookup: {
          from: 'rides',
          localField: '_id',
          foreignField: 'userId',
          as: 'rides'
        }
      },
      { $unwind: "$rides" },
      {
        $group: {
          _id: "$_id",
          name: { $first: "$name" },
          totalRides: { $sum: 1 },
          totalFare: { $sum: "$rides.fare" },
          avgDistance: { $avg: "$rides.distance" }
        }
      },
      {
        $project: {
          _id: 0,
          name: 1,
          totalRides: 1,
          totalFare: 1,
          avgDistance: { $round: ["$avgDistance", 2] }
        }
      }
    ]).toArray();

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
