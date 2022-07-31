const mongoose = require('mongoose');
const slugify = require('slugify');
//const User = require('./userModel');
//const validator = require('validator');

const tourSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'A tour must have a name'],
        unique: true,
        trim: true,
        maxlength: [40, 'A tour name cannot be longer than 40 characters'],
        minlength: [10, 'A tour name must have atleast 10 characters'],
        //validate: [validator.isAlpha, 'A tour name must only contain alphabetic characters']
    },
    slug: String,
    duration: {
        type: Number,
        required: [true, 'A tour must have a duration']
    },
    maxGroupSize: {
        type: Number,
        required: [true, 'A tour must have a group size']
    },
    difficulty: {
        type: String,
        required: [true, 'A tour must have a difficulty'],
        enum: {                                                         // enum is only for strings
            values: ['easy', 'medium', 'difficult'],
            message: 'Difficulty is either easy, medium, difficult'
        }
    },
    ratingsAverage: {
        type: Number,
        default: 4.5,
        min: [1, 'Rating cannot go below 1.0'],
        max: [5, 'Rating cannot go above 5.0'],
        set: val => Math.round(val * 10) / 10   // 4.666667, 46.6667, 47, 4.7
    },
    ratingsQuantity: {
        type: Number,
        default: 0
    },
    price: {
        type: Number,
        required: [true, 'A tour must have a price']
    },
    priceDiscount: {
        type: Number,
        validate: {
            validator: function(value){
                // this only points to current document on NEW document creation
                return value < this.price;      // Validating whether the price discount is less than the original price
            },
            message: 'Discounted price ({VALUE}) should be less than the original price'
        }
    },
    summary: {
        type: String,
        trim: true,
        required: [true, 'A tour must have a summary']     
    },
    description: {
        type: String,
        trim: true
    },
    imageCover: {
        type: String,
        required: [true, 'A tour must have a cover image']
    },
    images: [String],
    createdAt: {
        type: Date,
        default: Date.now(),
        select: false
    },
    startDates: [Date],
    secretTour: {
        type: Boolean,
        default: false
    },
    startLocation: {
        // Geo JSON
        type: {
            type: String,
            default: 'Point',
            enum: ['Point']
        },
        coordinates: [Number],
        address: String,
        description: String
    },
    locations: [
        {
            type: {
                type: String,
                default: 'Point',
                enum: ['Point']
            },
            coordinates: [Number],
            address: String,
            description: String,
            day: Number
        }
    ],
    guides: [
        {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        }
    ]
}, {
    toJSON: {virtuals: true},
    toObject: {virtuals: true}
});

// tourSchema.index({price: 1});
tourSchema.index({ price: 1, ratingsAverage: -1 });         // 1 for ascending -1 for descending
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' });

tourSchema.virtual('durationWeeks').get(function(){         // used normal function to get access to 'this'
   return this.duration / 7;                               // cannot use virtual properties with queries
});

// Virtual populate
tourSchema.virtual('reviews', {
    ref: 'Review',
    foreignField: 'tour',
    localField: '_id'
});

// DOCUMENT MIDDLWARE: runs before the .save() command and the .create() commmand  
tourSchema.pre('save', function(next){
    this.slug = slugify(this.name, {lower: true});
    next();
});


// MIDDLEWARE TO EMBED USER DOCUMENTS INTO TOUR COLLECTION USING USER ID. Guides field needs to be type 'Array' for this to work
// tourSchema.pre('save', async function(next){
//     const guidesPromises = this.guides.map(async id => await User.findById(id));
//     this.guides = await Promise.all(guidesPromises);
//     next();
// });

// tourSchema.pre('save', function(next){
//     console.log('Will save document...');
//     next();
// });

// tourSchema.post('save', function(doc, next){
//     console.log(doc);
//     next();
// });

//QUERY MIDDLEWARE
tourSchema.pre(/^find/, function(next){
    this.find({secretTour: {$ne: true}});

    this.start  = Date.now();
    next();
});

tourSchema.pre(/^find/, function(next){
    this.populate({
        path: 'guides',
        select: '-__v -passwordChangedAt'
    });
    next();
});

tourSchema.post(/^find/, function(docs, next){
    console.log(`Query took ${Date.now() - this.start} milliseconds`);
    next();
});

// AGGREGATION MIDDLEWARE
// tourSchema.pre('aggregate', function(next){
//     this.pipeline().unshift({$match: {secretTour: {$ne: true}}});

// //    console.log(this.pipeline());
//     next();
// });

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;