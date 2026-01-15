
const csv = require('csvtojson')
const path = require("path")
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb')




const csvFilePath = path.resolve(__dirname, '../data/flights_data.csv')

async function importFlightsCsv() {
    const uri = process.env.MONGO_URI
    const client = new MongoClient(uri)

    try {
        await client.connect()
        console.log("Connected to MongoDB")

        //Connect to database
        const db = client.db('skytrackr_db')
        const collection = db.collection('flights')

        const flights = await csv().fromFile(csvFilePath)
        console.log("Found ${flights.length} flights in CSV")

        const result = await collection.insertMany(flights)
        console.log ("Inserted ${result.insertedCount} flights into MongoDB")
    } catch (err) {
        console.error(err)
    } finally {
        await client.close()
        console.log("Connection closed")
    }
}

importFlightsCsv();

