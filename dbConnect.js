const mongoose = require('mongoose');
mongoose.set('strictQuery', false);
// connect to MongoDB Atlas
mongoose.connect("mongodb://localhost:27017/chatDb")
.then( () => console.log('Database connection established'))
.catch( err => console.log(err))