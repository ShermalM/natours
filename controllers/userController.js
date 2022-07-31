const multer = require('multer');
const sharp = require('sharp');
const AppError = require('../utils/appError');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const factory = require('./handlerFactory');

// const multerStorage = multer.diskStorage({
//     destination: (request, file, callback) => {
//         callback(null, 'public/img/users');
//     },
//     filename: (request, file, callback) => {
//         // user-userID-timestamp.jpeg       <-- to make sure 2 images can't have the same file name
//         const ext = file.mimetype.split('/')[1];
//         callback(null, `user-${request.user.id}-${Date.now()}.${ext}`);
//     }
// });

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

exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = catchAsync(async (request, response, next) => {
    if(!request.file) return next();

    request.file.filename = `user-${request.user.id}-${Date.now()}.jpeg`;

    await sharp(request.file.buffer)
        .resize(500, 500)
        .toFormat('jpeg')
        .jpeg({quality: 90})
        .toFile(`public/img/users/${request.file.filename}`);

    next();
});

const filterObj = (object, ...allowedFields) => {
    const newObject = {};
    Object.keys(object).forEach(element => {
        if(allowedFields.includes(element)) newObject[element] = object[element];
    });
    return newObject;
};

exports.getMe = (request, response, next) => {
    request.params.id = request.user.id;
    next();
};

exports.updateMe = catchAsync(async (request, response, next) => {
    // 1) Create error if user POSTs password data
    if(request.body.password || request.body.passwordConfirm){
        return next(new AppError('This route is not for password updates. Please use /updateMyPassword', 400));
    }

    // 2) Filtered out unwanted field names that are not allowed to be updated
    const filteredBody = filterObj(request.body, 'name', 'email');
    if(request.file) filteredBody.photo = request.file.filename;

    // 3) Update user document
    const updatedUser = await User.findByIdAndUpdate(request.user.id, filteredBody, {
        new: true,
        runValidators: true
    });

    response.status(200).json({
        status: 'success',
        data: {
            user: updatedUser
        }
    });
});

exports.deleteMe = catchAsync(async (request, response, next) => {
    await User.findByIdAndUpdate(request.user.id, {active: false});

    response.status(204).json({
        status: 'success',
        data: null
    });
});

exports.createUser = (request, response) => {
    response.status(500).json({                 //500 internal server error
        status: 'error',
        message: 'This route is not defined! Please use /signup instead'
    });
};

exports.getAllUsers = factory.getAll(User);
exports.getUser = factory.getOne(User);
// DO NOT UPDATE PASSWORD WITH THIS!
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);