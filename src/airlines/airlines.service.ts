import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Airline } from "./schemas/airline.schema";
import { AirlinePolicy } from "./schemas/airline-policy.schema";
import path from "path";
import { Model } from "mongoose";
import * as fs from 'fs';
import csv from 'csv-parser';
import { AIRLINE_POLICIES_SEED } from "./data/airline-policies.seed";

@Injectable()
export class AirlinesService implements OnApplicationBootstrap {
    constructor(
        @InjectModel('Airline') private airlineModel: Model<Airline>,
        @InjectModel('AirlinePolicy') private policyModel: Model<AirlinePolicy>,
    ){}

    private airlineCache: Map<string, any> = new Map();

    async onApplicationBootstrap() {
        const filePath = path.join(process.cwd(), 'src/airlines/data/airlines.dat.txt');
        await this.importIfEmpty(filePath);
        await this.seedPoliciesIfEmpty();
    }

    async seedPoliciesIfEmpty() {
        const count = await this.policyModel.countDocuments();
        if (count > 0) return;
        try {
            await this.policyModel.insertMany(AIRLINE_POLICIES_SEED);
            console.log(`Seeded ${AIRLINE_POLICIES_SEED.length} airline policies.`);
        } catch (err) {
            console.error('Error seeding airline policies:', err.message);
        }
    }

    async importIfEmpty(filePath: string)
    {
        const count = await this.airlineModel.countDocuments()
        if (count > 0)
        {
            console.log("Already import data.")
            return;
        }
        const results: any[] = [];
        const headers = ['id', 'name', 'alias', 'iata', 'icao', 'callsign', 'country', 'active'];
        if (!fs.existsSync(filePath)) {
            console.log("Airline file path is wrong!! Current path:", filePath);
            return;
        }

        fs.createReadStream(filePath)
            .pipe(csv({ headers }))
            .on('data', (row) => {
                const name = row.name?.replace(/"/g, '').trim();
                const iata = row.iata?.replace(/"/g, '').trim();
                const icao = row.icao?.replace(/"/g, '').trim();
                if (name && name !== '\\N' && ((iata && iata !== '\\N') || (icao && icao !== '\\N'))) {
                    let logoCode = '';    
                    if (icao && icao !== '\\N') {
                        logoCode = icao.toUpperCase();
                    } else if (iata && iata !== '\\N') {
                        logoCode = iata.toUpperCase();
                    }
                    
                    results.push({
                        openFlightsId: parseInt(row.id),
                        name: name,
                        iata: (iata && iata !== '\\N' && iata !== '-') ? iata.toUpperCase() : '',
                        icao: (icao && icao !== '\\N') ? icao.toUpperCase() : '',
                        country: row.country?.replace(/"/g, ''),
                        active: row.active?.replace(/"/g, ''),

                        logo: logoCode 
                            ? `${process.env.GITHUB_LOGO_BASE}/${logoCode}.png` 
                            : ''
                    });
                }
            })
            .on('end', async () => {
                try {
                    if (results.length > 0) {
                        await this.airlineModel.insertMany(results);
                        console.log(`Import ${results.length} airlines successfully!`);
                    }
                } catch (error) {
                    console.error('Error while inserting Airlines into MongoDB:', error);
                }
            });
    }
    private policyLogo(iata: string): string {
        return `https://www.gstatic.com/flights/airline_logos/70px/${iata}.png`;
    }

    async getAllPolicies(search?: string, alliance?: string) {
        const filter: any = {};
        if (alliance && alliance !== 'All') filter.alliance = alliance;
        if (search) filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { iata: { $regex: search, $options: 'i' } },
            { country: { $regex: search, $options: 'i' } },
        ];
        const results = await this.policyModel.find(filter).lean();
        return results.map(a => ({ ...a, logo: this.policyLogo(a.iata) }));
    }

    async getPolicyByIata(iata: string) {
        const policy = await this.policyModel.findOne({ iata: iata.toUpperCase() }).lean();
        if (!policy) return null;
        return { ...policy, logo: this.policyLogo(policy.iata) };
    }

    async getAirlineByIata(iataCode: string) {
        if (!iataCode) return null;
        if (this.airlineCache.has(iataCode)) {
            return this.airlineCache.get(iataCode);
        }
        try {
            const airline = await this.airlineModel
                .findOne({ iata: iataCode })
                .sort({ active: -1 })
                .lean();

            if (airline) {
                const result = {
                name: airline.name,
                logo: airline.logo,
                country: airline.country
                };
                
                this.airlineCache.set(iataCode, result);
                return result;
            }
            return { 
                name: iataCode, 
                logo: `https://www.gstatic.com/flights/airline_logos/70px/${iataCode}.png` 
            };
        } catch (error) {
            // this.logger.error(`Lỗi khi tìm hãng bay ${iataCode}: ${error.message}`);
            console.log("Error while get airline", error.message)
            return { name: iataCode, logo: '' };
        }
    }
}