const mongoose = require('mongoose');
const uid = require('uid2');

const Schema = mongoose.Schema;

const PageSchema = new Schema({
    url: {type: String, unique: true, required: true, dropDups: true},
    domain: String,
    fetched: { type: Boolean, default: false },
    fetching: { type: Boolean, default: false },
    fetchDate: Date,
    fetchInterest: { type: Number, default: 0 },

    match: { type: Boolean, default: false },
    language: { type: String, default: null },
}, {
    autoIndex: true,
    strict: true,
    minimize: false,
    versionKey: false,
    timestamps: true,
});

module.exports = mongoose.model('Page', PageSchema);
