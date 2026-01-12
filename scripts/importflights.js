
const csv = require('csvtojson')
require('dotenv').config()
const { MongoClient } = require('mongodb')




const csvFilePath = 'data/flight_log_mock_data.csv'

async function importFlightsCsv() {
    const uri = process.env.MONGO_URI
    const client = new MongoClient(uri)

    try {
        await client.connect()
        console.log("Connected to MongoDB")

        //Connect to database
        const db = client.db('skytrackr_db')
        const collection = db.collection('flights')

        const flights = await csv().fromFile(flights_data.csv)
        console.log("Found ${flights.length} flights in CSV")

        const result = await collection.insertMany(flights)
        console.log ("Inserted ${result.insertedCount} flights into MongoDB")
    } catch (err) {
        console.error(err)
    } finally {
        await client.clase()
        console.log("Connection closed")
    }
}

importFlightsCsv();

