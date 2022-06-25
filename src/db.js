const mongoose = require('mongoose');

const DB_URI = process.env.DB_URI;

let uri = DB_URI;

module.exports = {
  DB_URI,
  connect: () => {
    return mongoose.connect(uri).catch((err) => console.log(err));
  },
  closeDatabase: async (drop = false) => {
    drop && (await mongoose.connection.dropDatabase());
    await mongoose.disconnect();
    await mongoose.connection.close();
  },

  clearDatabase: async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany();
    }
  },
};
