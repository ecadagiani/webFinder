const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const PageSchema = new Schema({
    url: {type: String, unique: true, required: true, dropDups: true},
    domain: {type: String, ref: 'Domain', index: true},
    fetched: { type: Boolean, default: false, index: true },
    fetching: { type: Boolean, default: false, index: true },
    fetchDate: Date,
    fetchInterest: { type: Number, default: 0, index: true },

    match: { type: Boolean, default: false },
    matchTags: [{ type: String }],
    language: { type: String, default: null },

    error: { type: Boolean, default: false, index: true },
    errorMessage: String,
}, {
    autoIndex: false,
    strict: true,
    minimize: true,
    versionKey: false,
    timestamps: true,
});

module.exports = PageSchema;
