const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('./../utils/apiFeatures');

exports.deleteOne = Model => 
    catchAsync(async (request, response, next) => {
        const doc = await Model.findByIdAndDelete(request.params.id);

        if(!doc){
            return next(new AppError('No document with that ID found', 404));
        }

        response.status(204).json({           //204 means No Content
            status: "success",
            data: null
        });
    });

exports.updateOne = Model => 
    catchAsync(async (request, response, next) => {
        const doc = await Model.findByIdAndUpdate(request.params.id, request.body, {
            new: true,   //to return the modified document instead of the original. default is false
            runValidators: true
        });

        if(!doc){
            return next(new AppError('No document with that ID found!', 404));
        }

        response.status(200).json({
            status: "success",
            data: {
                data: doc
            }
        });
    });

exports.createOne = Model =>
    catchAsync(async (request, response, next) => {
        const doc = await Model.create(request.body);
            
            response.status(201).json({
                status: "success",
                data: {
                    data: doc
                }
            });
    });

exports.getOne = (Model, popOptions) => 
    catchAsync(async (request, response, next) => {
        let query = Model.findById(request.params.id);
        if(popOptions) query = query.populate(popOptions);

        const doc = await query;
        //const doc = await doc.findOne({ _id: request.params.id });

        if(!doc){
            return next(new AppError('No document with that ID found!', 404));
        }

        response.status(200).json({
            status: 'success',
            data: {
                data: doc
            }
        });   
    });

exports.getAll = Model => 
    catchAsync(async (request, response, next) => {
        // To allow for nested GET reviews on tour (hack)
        let filter = {};
        if(request.params.tourID) filter = {tour: request.params.tourID};

        // EXECUTE QUERY
        const features = new APIFeatures(Model.find(filter), request.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();

        // const doc = await features.query.explain();
        const doc = await features.query;

        // SEND RESPONSE
        response.status(200).json({
            status: 'success',
            results: doc.length,
            data: {
                data: doc
            }
        });
    });