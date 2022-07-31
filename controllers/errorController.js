const e = require("express");
const AppError = require("../utils/appError");

const handleCastErrorDB = error => {
    const message = `Invalid ${error.path}: ${error.value}`;
    return new AppError(message, 400);
};

const handleDuplicateFieldsDB = error => {
    const value = error.errmsg.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value: ${value}. Plese use another value`;
    return new AppError(message, 400);
};

const handleValidationErrorDB = error => {
    const errors = Object.values(error.errors).map(element => element.message);
    const message = `Invalid Input Data. ${errors.join('. ')}`;
    return new AppError(message, 400);
};

const handleJWTError = () => new AppError('Invalid token. Please log in again', 401);

const handleJWTExpiredError = () => new AppError('Your token has expired! Please log in again!', 401);

const sendErrorDev = (error, request, response) => {
    if(request.originalUrl.startsWith('/api')){
        // A) API
        return response.status(error.statusCode).json({
            status: error.status,
            error: error,
            message: error.message,
            stack: error.stack
        });
    }
    // B) RENDERED WEBSITE
    console.error('ERROR ', error);
    response.status(error.statusCode).render('error', {
        title: 'Something went wrong!',
        message: error.message
    });
};

const sendErrorProd = (error, request, response) => {
    if(request.originalUrl.startsWith('/api')){
        // A) API
        if(error.isOperational){
        // Operational, trusted error: send message to client
            return response.status(error.statusCode).json({
                status: error.status,
                message: error.message,
            });
        }
        // Programming or other unknown error: don't leak details
        // 1) Log error
        console.error('ERROR ', error);

        // 2) Send generic message
        return response.status(error.statusCode).json({
            status: "error",
            message: "Something went very wrong!",
        });
    } 
    // B) RENDERED WEBSITE
    if(error.isOperational){
        // Operational, trusted error: send message to client
        return response.status(error.statusCode).render('error', {
            title: 'Something went wrong!',
            message: error.message
        });
    }
    // Programming or other unknown error: don't leak details
    // 1) Log error
    console.error('ERROR ', error);
    // 2) Send generic message
    return response.status(error.statusCode).render('error', {
        title: 'Something went wrong!',
        message: "Please try again later."
    });
};

module.exports = (error, request, response, next) => {
    error.statusCode = error.statusCode || 500;         // 500 Internal Server Error
    error.status = error.status || 'error';

    if(process.env.NODE_ENV === 'development'){
        sendErrorDev(error, request, response);
    }else if(process.env.NODE_ENV === 'production'){
        let errorCopy = Object.assign(error);
        
        if(errorCopy.name === 'CastError')  errorCopy = handleCastErrorDB(errorCopy);
        if(errorCopy.code === 11000) errorCopy = handleDuplicateFieldsDB(errorCopy);
        if(errorCopy.name === 'ValidationError') errorCopy = handleValidationErrorDB(errorCopy);
        if(errorCopy.name === 'JsonWebTokenError') errorCopy = handleJWTError();
        if(errorCopy.name === 'TokenExpiredError') errorCopy = handleJWTExpiredError();

        sendErrorProd(errorCopy, request, response);
    }
};