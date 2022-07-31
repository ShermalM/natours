const multer = require('multer');
const sharp = require('sharp');
const Tour = require('./../models/tourModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

//const tours = JSON.parse(fs.readFileSync(`${__dirname}/../dev-data/data/tours-simple.json`));

const multerStorage = multer.memoryStorage();       // image will be stored as a buffer

const multerFilter = (request, file, callback) => {
    if(file.mimetype.startsWith('image')){
        callback(null, true);
    } else{
        callback(new AppError('Not an image! Please upload images only.', 400), false);
    }
};

const upload = multer({
    storage: multerStorage,
    fileFilter: multerFilter
});

// upload.array('images', 3);

exports.uploadTourImages = upload.fields([
    {name: 'imageCover', maxCount: 1},
    {name: 'images', maxCount: 3}
]);

exports.resizeTourImages = catchAsync(async (request, response, next) => {
    if(!request.files.imageCover || !request.files.images) return next();
    
    // 1) Cover Image
    request.body.imageCover = `tour-${request.params.id}-${Date.now()}-cover.jpeg`;
    await sharp(request.files.imageCover[0].buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({quality: 90})
        .toFile(`public/img/tours/${request.body.imageCover}`);
    
    // 2) Images
    request.body.images = [];
    await Promise.all(request.files.images.map(async (file, index) => {
        const filename = `tour-${request.params.id}-${Date.now()}-${index + 1}.jpeg`;

        await sharp(file.buffer)
            .resize(2000, 1333)
            .toFormat('jpeg')
            .jpeg({quality: 90})
            .toFile(`public/img/tours/${filename}`);
        
        request.body.images.push(filename);
    }));

    console.log(request.body);
    next(); 
});

exports.aliasTopTours = (request, response, next) => {
    request.query.limit = '5';
    request.query.sort = '-ratingsAverage,price';
    request.query.fields = 'name,price,ratingsAverage,summary,difficulty';
    next();
};

exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, {path: 'reviews'})
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);

exports.getTourStats = catchAsync(async (request, response, next) =>  {
    const stats = await Tour.aggregate([
        {
            $match: {ratingsAverage: {$gte: 4.5}}
        },
        {
            $group: {
                _id: {$toUpper: '$difficulty'},
                numTours: {$sum: 1},
                numRatings: {$sum: '$ratingsQuantity'},
                avgRating: {$avg: '$ratingsAverage'},
                avgPrice: {$avg: '$price'},
                minPrice: {$min: '$price'},
                maxPrice: {$max: '$price'}
            }
        },
        {
            $sort: {avgPrice: 1}        // 1 for ascending
        }
        // {
        //     $match: {_id: {$ne: 'EASY'}}
        // }
    ]);

    response.status(200).json({
        status: "success",
        data: {
            stats
        }
    });
});

exports.getMonthlyPlan = catchAsync(async (request, response, next) => {
    const year = request.params.year * 1;   // 2021

    const plan = await Tour.aggregate([
        {
            $unwind: '$startDates'
        },
        {
            $match: {
                startDates: {
                    $gte: new Date(`${year}-01-01`),
                    $lte: new Date(`${year}-12-31`)
                }
            }
        },
        {
            $group: {
                _id: {$month: '$startDates'},
                numTourStarts: {$sum: 1},
                tours: {$push: '$name'}
            }
        },
        {
            $addFields: {month: '$_id'}
        },
        {
            $project: {
                _id: 0
            }
        },
        {
            $sort: {numTourStarts: -1}      // -1 for descending
        },
        {
            $limit: 12                      // Limiting the number of results to 12. redundant in this code, just for refence
        }
    ]);

    response.status(200).json({
        status: "success",
        data: {
            plan
        }
    });
});


// /tours-within/233/center/34.111745,-118.113491/unit/mi
exports.getToursWithin = catchAsync(async (request, response, next) => {
    const { distance, latlng, unit } = request.params;
    const [lat, lng] = latlng.split(',');

    const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;       // mongo expects the radius in radians. radians = distance/ radius of earth

    if(!lat || !lng){
        next(new AppError('Please provide latitude and longitude in the format lat,lng ', 400));
    }
    
    const tours = await Tour.find({ startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } } });

    response.status(200).json({
        status: 'success',
        results: tours.length,
        data: {
            data: tours
        }
    });
});

exports.getDistances = catchAsync(async (request, response, next) => {
    const { latlng, unit } = request.params;
    const [lat, lng] = latlng.split(',');

    const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

    if(!lat || !lng){
        next(new AppError('Please provide latitude and longitude in the format lat,lng ', 400));
    }

    const distances = await Tour.aggregate([
        {
            $geoNear: {
                near: {
                    type: 'Point',
                    coordinates: [lng * 1, lat * 1]
                },
                distanceField: 'distance',
                distanceMultiplier: multiplier
            }
        },
        {
            $project: {
                distance: 1,
                name: 1
            }
        }
    ]);

    response.status(200).json({
        status: 'success',
        data: {
            data: distances
        }
    });
});