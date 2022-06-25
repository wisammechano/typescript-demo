import mongoose from 'mongoose';

const DB_URI = process.env['DB_URI'];

let uri = DB_URI;

export default {
  DB_URI,
  connect: () => {
    if (!uri) throw new Error('DB_URI is not defined');

    return mongoose.connect(uri).catch((err: any) => console.log(err));
  },
  closeDatabase: async (drop = false) => {
    drop && (await mongoose.connection.dropDatabase());
    await mongoose.disconnect();
    await mongoose.connection.close();
  },

  clearDatabase: async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  },
};
