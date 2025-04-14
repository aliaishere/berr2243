const { MongoClient } = require("mongodb");

const drivers = [
  {
    name: "John Doe",
    vehicleType: "Sedan",
    isAvailable: true,
    rating: 4.8
  },
  {
    name: "Alice Smith",
    vehicleType: "SUV",
    isAvailable: false,
    rating: 4.5
  }
];

drivers.push({
  name: "Alia Amirah",
  vehicleType: "Jeep", 
  isAvailable: true,
  rating: 5.0
});

console.log(drivers);

drivers.forEach(driver => {
  console.log(driver.name);
});

async function main() {
  const uri = "mongodb://localhost:27017";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("testDB");
    const driversCollection = db.collection("drivers");

    // Insert all drivers
    await Promise.all(drivers.map(async (driver) => {
      const result = await driversCollection.insertOne(driver);
      console.log(`New driver inserted with _id: ${result.insertedId}`);
    }));

    // Update rating of John Doe
    const updateResult = await driversCollection.updateMany(
      { name: "John Doe" },
      { $inc: { rating: 0.1 } }
    );
    console.log(`Driver updated: ${updateResult.modifiedCount}`);

    // Delete a driver who is not available
    const deleteResult = await driversCollection.deleteMany({ isAvailable: false });
    console.log(`Driver deleted: ${deleteResult.deletedCount}`);

    // Find available drivers with rating >= 4.5
    const availableDrivers = await driversCollection.find({
      isAvailable: true,
      rating: { $gte: 4.5 }
    }).toArray();
    console.log("Available drivers:", availableDrivers);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.close();
  }
}

main();
