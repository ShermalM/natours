const crypto = require('crypto');
const {promisify} = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const Email = require('./../utils/email');

const signToken = id => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
};

const createSendToken = (user, statusCode, response) => {
    const token = signToken(user._id);
    const cookieOptions = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
        httpOnly: true          // So user cannot manipulate/delete cookie from the browser, so it is secure
    };

    if(process.env.NODE_ENV === 'production')   cookieOptions.secure = true;
    
    response.cookie('jwt', token, cookieOptions);

    // Remove password from the output
    user.password = undefined;

    response.status(statusCode).json({
        status: 'success',
        token,
        data: {
            user
        }
    });
};

exports.signup = catchAsync(async (request, response, next) => {
    const newUser = await User.create({
        name: request.body.name,
        email: request.body.email,
        password: request.body.password,
        passwordConfirm: request.body.passwordConfirm
    });

    const url = `${request.protocol}://${request.get('host')}/me`;
    console.log(url);
    await new Email(newUser, url).sendWelcome();

    createSendToken(newUser, 201, response);
});

exports.login = catchAsync(async (request, response, next) => {
    const {email, password} = request.body;

    // 1) Check if email and password exist
    if(!email || !password){
        return next(new AppError('Please provide email and password!', 400));
    }

    // 2) Check if the user exists && password is correct
    const user = await User.findOne({email}).select('+password');

    if(!user || !(await user.correctPassword(password, user.password))){
        return next(new AppError('Incorrect email or password', 401));      // 401 for unauthorized
    }

    // 3) If everything is ok, send token to client
    createSendToken(user, 200, response);
});

exports.logout = (request, response) => {
    response.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });
    response.status(200).json({status: 'success'});
};

exports.protect = catchAsync(async (request, response, next) => {
    // 1) Getting token and check if it's there
    let token;
    if(request.headers.authorization && request.headers.authorization.startsWith('Bearer')){
        token = request.headers.authorization.split(' ')[1];
    } else if(request.cookies.jwt && request.cookies.jwt !== 'loggedout'){
        token = request.cookies.jwt;
    }

    if(!token){
        return next(new AppError('You are not logged in! Please login to get access', 401));
    }

    // 2) Verification token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if(!currentUser){
        return next(new AppError('The user belonging to the token no longer exists', 401));
    }

    // 4) Check if user changed password after the token was issued
    if(currentUser.changedPasswordAfter(decoded.iat)){
        return next(new AppError('User has changed password! Please login again', 401));
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    request.user = currentUser;
    response.locals.user = currentUser;
    next();
});

// Only for rendered pages, there will be no errors!
exports.isLoggedIn = async (request, response, next) => {
    if(request.cookies.jwt){
        try{
            // 1) Verify the token
            const decoded = await promisify(jwt.verify)(request.cookies.jwt, process.env.JWT_SECRET);

            // 2) Check if user still exists
            const currentUser = await User.findById(decoded.id);
            if(!currentUser){
                return next();
            }

            // 3) Check if user changed password after the token was issued
            if(currentUser.changedPasswordAfter(decoded.iat)){
                return next();
            }

            // THERE IS A LOGGED IN USER
            response.locals.user = currentUser;
        } catch(err){
            return next();
        }
    }
    next();
};

exports.restrictTo = (...roles) => {
    return (request, response, next) => {
        // roles is an array
        if(!roles.includes(request.user.role)){
            return next(new AppError('You do not have permission to perform this action', 403));    // 403 for forbidden
        }

        next();
    };
};

exports.forgotPassword = catchAsync(async (request, response, next) => {
    // 1) Get user based on POSTed email
    const user = await User.findOne({email: request.body.email});
    if(!user){
        return next(new AppError('There is no email with that email address', 404));
    }

    // 2) Generate the random reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // 3) Send it to user's email
    try{
        const resetURL = `${request.protocol}://${request.get('host')}/api/v1/users/resetPassword/${resetToken}`;
        await new Email(user, resetURL).sendPasswordReset();
    
        response.status(200).json({
            status: 'success',
            message: 'Token sent to email!'
        });
    } catch(err){
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        return next(new AppError('There was an error sending the email. Try again later!', 500));
    }
});

exports.resetPassword = catchAsync(async (request, response, next) => {
    // 1) Get user based on the token
    const hashedToken = crypto.createHash('sha256').update(request.params.token).digest('hex');
    const user = await User.findOne({passwordResetToken: hashedToken, passwordResetExpires: {$gt: Date.now()}});

    // 2) If token is not expired, and there is a user, set the new password
    if(!user){
        return next(new AppError('Token is invalid or has expired', 400));
    }
    user.password = request.body.password;
    user.passwordConfirm = request.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // 3) Update changedPasswordAt property for the current user

    // 4) Log the user in, send JWT to client
    createSendToken(user, 200, response);
});

exports.updatePassword = catchAsync(async (request, response, next) => {
    // 1) Get the user from the collection
    const user = await User.findById(request.user.id).select('+password');

    // 2) Check if POSTed password is correct
    if(!(await user.correctPassword(request.body.passwordCurrent, user.password))){
        return next(new AppError('Your current password is wrong', 401));
    }

    // 3) If so, update password
    user.password = request.body.password;
    user.passwordConfirm = request.body.passwordConfirm;
    await user.save();

    // 4) Log user in, send JWT
    createSendToken(user, 200, response);
});