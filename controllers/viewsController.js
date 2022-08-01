const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

exports.alerts = (request, response, next) => {
    const {alert} = request.query;
    if(alert === 'booking')
        response.locals.alert = 'Your booking was successful! Please check your email for a confirmation. If your booking doesn\'t show up here immediately, please come back later.';
    next();
};

exports.getOverview = catchAsync(async (request, response, next) => {
    // 1) Get tour data from collection
    const tours = await Tour.find();

    // 2) Build template
    // 3) Render that template using the tour data from Step 1
    response.status(200).render('overview', {
        title: 'All Tours',
        tours
    });
});

exports.getTour = catchAsync(async (request, response, next) => {
    // 1) Get the data, for the requested tour (including reviews and guides)
    const tour = await Tour.findOne({slug: request.params.slug}).populate({
        path: 'reviews',
        fields: 'review rating user'
    });

    if(!tour){
        return next(new AppError('There is no tour with that name.', 404));
    }

    // 2) Build template
    // 3) Render template using data from Step 1
    response.status(200).render('tour', {
        title: `${tour.name} Tour`,
        tour
    });
});

exports.getLoginForm = (request, response, next) => {
    if(response.locals.user) return next(new AppError('You are already logged in as a user', 404));

    // Render template
    response.status(200).render('login', {
        title: 'Log into your account'
    });
};

exports.getSignupForm = (request, response, next) => {
    if(response.locals.user) return next(new AppError('You are already logged in as a user', 404));

    // Render template
    response.status(200).render('signup', {
        title: 'Sign up here'
    });
}

exports.getAccount = (request, response) => {
    // Render template
    response.status(200).render('account', {
        title: 'Your account'
    });
};

exports.getMyTours = catchAsync(async (request, response, next) => {
    // 1) Find all bookings
    const bookings = await Booking.find({user: request.user.id}); 

    // 2) Find tours with the returned IDs
    const tourIDs = bookings.map(element => element.tour);
    const tours = await Tour.find({ _id: {$in: tourIDs} });

    response.status(200).render('overview', {
        title: 'My tours',
        tours
    });
});

exports.updateUserData = catchAsync(async (request, response, next) => {
    const updatedUser = await User.findByIdAndUpdate(request.user.id, {
        name: request.body.name,
        email: request.body.email
    },
    {
        new: true,
        runValidators: true
    });
    // Render template
    response.status(200).render('account', {
        title: 'Your account',
        user: updatedUser
    });
});