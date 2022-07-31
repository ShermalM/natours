const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');


exports.getCheckoutSession = catchAsync(async (request, response, next) => {
    // 1) Get the currently booked tour
    const tour = await Tour.findById(request.params.tourID);

    // 2) Create checkout session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        // success_url: `${request.protocol}://${request.get('host')}/my-tours?tour=${tour.id}&user=${request.user.id}&price=${tour.price}`,
        success_url: `${request.protocol}://${request.get('host')}/my-tours`,
        cancel_url: `${request.protocol}://${request.get('host')}/tour/${tour.slug}`,
        customer_email: request.user.email,
        client_reference_id: request.params.tourID,
        mode: 'payment',
        line_items: [
            {
                quantity: 1,
                price_data: {
                    currency: 'usd',
                    unit_amount: tour.price * 100,
                    product_data: {
                        name: `${tour.name} Tour`,
                        description: tour.summary,
                        images: [`${request.protocol}://${request.get('host')}/img/tours/${tour.imageCover}`]
                    }
                }
            }
        ]
    });

    // 3) Create session as response
    response.status(200).json({
        status: 'success',
        session
    });
});

// exports.createBookingCheckout = catchAsync(async (request, response, next) => {
//     // This is only TEMPORARY, because it's UNSECURE: everyone can make bookings without paying
//     const {tour, user, price} = request.query;

//     if(!tour || !user || !price) return next();

//     await Booking.create({tour, user, price});
//     response.redirect(request.originalUrl.split('?')[0]);
// });

const createBookingCheckout = async session => {
    const tour = session.client_reference_id;
    const user = (await User.findOne({email: session.customer_email})).id;
    const price = session.amount_total / 100;
    await Booking.create({tour, user, price});
};

exports.webhookCheckout = (request, response, next) => {
    const signature = request.headers['stripe-signature'];
    let event;
    try{
        event = stripe.webhooks.constructEvent(request.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch(err){
        return response.status(400).send(`Webhook error: ${error.message}`);
    }

    if(event.type === 'checkout.session.completed')
        createBookingCheckout(event.data.object);
    
    response.status(200).json({received: true});
};

exports.getAllBookings = factory.getAll(Booking);
exports.getBooking = factory.getOne(Booking);
exports.createBooking = factory.createOne(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);