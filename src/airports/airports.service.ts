import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as path from "path";
import * as fs from 'fs';
import csv from 'csv-parser';

@Injectable()
export class AirportsService implements OnApplicationBootstrap{
    constructor(
        @InjectModel('Airport') private airportModel: Model<any>
    ){}

    async onApplicationBootstrap() {
        const filePath = path.join(process.cwd(), 'src/airports/data/airports.dat.txt')
        await this.importIfEmpty(filePath)
    }

    async importIfEmpty(filePath: string)
    {
        const count = await this.airportModel.countDocuments();
        if (count > 0)
        {
            console.log("Data already imported");
            return;
        }
        const results: any[] = [];
        const headers = ['id', 'name', 'city', 'country', 'iata', 'icao', 'lat', 'lon', 'alt', 'tz', 'dst', 'tz_db', 'type', 'source'];

        if(!fs.existsSync(filePath))
        {
            console.log(process.cwd())
            console.log("Path is wrong!! Current path:", filePath);
            return;
        }
        fs.createReadStream(filePath)
            .pipe(csv({ headers }))
            .on('data', (row) => {
                const iata = row.iata?.replace(/"/g, '').trim();
                const city = row.city?.replace(/"/g, '').trim();
                if (iata && iata !== '\\N' && city && city !== '\\N') {
                    results.push({
                        name: row.name.replace(/"/g, ''),
                        city: row.city.replace(/"/g, ''),
                        country: row.country.replace(/"/g, ''),
                        iata: row.iata.replace(/"/g, '').toUpperCase(),
                        coordinates: [parseFloat(row.lon), parseFloat(row.lat)],
                    });
                }
            })
            .on('end', async () => {
                try {
                await this.airportModel.insertMany(results);
                console.log(`Import ${results.length} airports successfully!`);
                } catch (error) {
                console.error('Error while inserting into MongoDB:', error);
                }
            });
    }

    async suggestAirports(term: string) {
        const regex = new RegExp(`^${term}`, 'i');

        return this.airportModel.aggregate([
            {
            $match: {
                $or: [
                { iata: regex },
                { city: regex },
                { name: regex }
                ]
            }
            },
            {
            $addFields: {
                priority: {
                $cond: {
                    if: { $eq: [{ $toUpper: "$iata" }, term.toUpperCase()] },
                    then: 1,
                    else: {
                    $cond: {
                        if: { $regexMatch: { input: "$iata", regex: regex } },
                        then: 2, 
                        else: 3 
                    }
                    }
                }
                }
            }
            },
            { $sort: { priority: 1, name: 1 } }, 
            { $limit: 10 },
            { $project: { name: 1, city: 1, country: 1, iata: 1, _id: 0 } }
        ]);
        }
}