const mongoose = require('mongoose');
const dotenv = require('dotenv');

process.on('uncaughtException', error => {
    console.log('UNCAUGHT EXCEPTION! Shutting down...');
    console.log(error);
    process.exit(1); 
});

dotenv.config({path: './config.env'});
const app = require('./app');

const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);
mongoose.connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false
}).then(() => console.log('DB connection successful!'));


const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`App running on port ${PORT}...`);
});

process.on('unhandledRejection', error => {
    console.log('UNHANDLED REJECTION! Shutting down...');
    console.log(error); 
    server.close(() => {
        process.exit(1);           // 0 stands for success. 1 stands for uncalled exception
    });
});