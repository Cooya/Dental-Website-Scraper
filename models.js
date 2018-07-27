const mongoose = require('mongoose');

const CategoryLinkSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true,
        unique: true
    },
    processed: {
        type: Boolean,
        required: true
    }
});

const ItemLinkSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true,
        unique: true
    },
    processed: {
        type: Boolean,
        required: true
    }
});

const ItemSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true,
        unique: true
    },
    designation: {
        type: String,
        required: true
    },
    reference: {
        type: String,
        required: true
    },
    barcode: {
        type: String,
        required: true
    },
    brand: {
        type: String,
        required: false
    },
    currentPrice: {
        type: Number,
        required: false
    },
    priceBefore: {
        type: Number,
        required: false
    },
    lots: {
        type: String,
        required: false
    }
});

ItemSchema.pre('validate', function(next) {
    const docKeys = Object.keys(this.toObject()); // new Object(this) is not working
    for(let schemaKey in ItemSchema.obj)
        if(!docKeys.includes(schemaKey))
            return next(new Error('"' + schemaKey + '" key is required.'));
    next();
});

module.exports = {
    CategoryLink: mongoose.model('CategoryLink', CategoryLinkSchema),
    ItemLink: mongoose.model('ItemLink', ItemLinkSchema),
    Item: mongoose.model('Item', ItemSchema)
};