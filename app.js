const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const cors = require('cors');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const viewRouter = require('./routes/viewRoutes');

// Start express app
const app = express();

app.enable('trust proxy');

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// 1) GLOBAL MIDDLEWARES
// Implement CORS
app.use(cors());

// app.use(cors({
//     origin: 'https://www.natours.com'        
// }));

app.options('*', cors());
// app.options('/api/v1/tours/:id', cors());

// Serving static files
app.use(express.static(path.join(__dirname, 'public')));

// Set Security HTTP Headers
app.use(helmet());

// Development logging
if(process.env.NODE_ENV === 'development'){
    app.use(morgan('dev')); 
} 

// Limit requests from the same IP
const limiter = rateLimit({
    max: 100,                           // 100 requests per hour
    windowM: 60 * 60 * 1000,            //  hour in milliseconds
    message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);

// Body parser, reading data from the body into request.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));     // to parse data coming from a form
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitazation against XSS (Cross-Site Scripting Attacks)
app.use(xss());

// Prevent parameter pollution
app.use(hpp({
    whitelist: [
        'duration',
        'ratingsQuantity', 
        'ratingsAverage', 
        'maxGroupSize', 
        'difficulty', 
        'price'
    ]
}));

app.use(compression());

// Test middleware
app.use((request, response, next) => {
    request.requestTime = new Date().toISOString();
//    console.log(request.cookies);
    next();
});


// 3) ROUTES
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);           //Mounting the router
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

app.all('*', (request, response, next) => {
    next(new AppError(`Cannot find ${request.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;