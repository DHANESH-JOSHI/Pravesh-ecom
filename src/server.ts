import "./app/config/moduleAlias"
import mongoose from 'mongoose';
import app from './app';
import config from "./app/config"
import { seedDatabase } from "./seeder";
async function main() {
    try {
        await mongoose.connect(config.DATABASE_URL as string);
        console.log('[DB] Database connected successfully');
        await seedDatabase();
        app.listen(config.PORT, () => {
            console.log(`server is running on port ${config.PORT}`)
        })

    } catch (err) {
        console.log(err)
    }
}
main();