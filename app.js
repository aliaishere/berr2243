const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;
const DB_NAME = 'eHailingDB';

mongoose.connect(`mongodb://localhost:27017/${DB_NAME}`)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use(express.json());

// Insert sample data once
async function seedSampleDataIfEmpty() {
  const db = mongoose.connection;
  const usersCount = await db.collection('users').countDocuments();
  const ridesCount = await db.collection('rides').countDocuments();

  if (usersCount === 0 && ridesCount === 0) {
    await db.collection('users').insertMany([
      { _id: 1, name: 'Alice' },
      { _id: 2, name: 'Bob' }
    ]);

    await db.collection('rides').insertMany([
      { _id: 101, userId: 1, fare: 18.9, distance: 10.5 },
      { _id: 102, userId: 1, fare: 18.9, distance: 10.2 },
      { _id: 103, userId: 2, fare: 18.75, distance: 9.8 }
    ]);

    console.log('Sample data inserted');
  } else {
    console.log('Sample data already exists');
  }
}

// Aggregation Route
app.get('/analytics/passengers', async (req, res) => {
  try {
    const result = await mongoose.connection.collection('users').aggregate([
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

// Start Server
mongoose.connection.once('open', async () => {
  await seedSampleDataIfEmpty();
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
});


