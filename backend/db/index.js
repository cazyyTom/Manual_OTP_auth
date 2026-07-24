import mongoose from "mongoose";

const connectDB = async () => {
    try{
        const connectionInstance = await mongoose.connect(process.env.MONGO_DB_URI);
        console.log(`/n MongoDB connected Host: ${connectionInstance.connection.host} /n `);
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1);
    }
}
