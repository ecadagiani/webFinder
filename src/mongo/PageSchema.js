const mongoose = require('mongoose');
const uid = require('uid2');

const Schema = mongoose.Schema;

const PageSchema = new Schema({
    //_id: { type: mongoose.Types.ObjectId, default() { return mongoose.Types.ObjectId(uid(12).toHexadecimal()); } },
    _id: { type: mongoose.Types.ObjectId, default: () => mongoose.Types.ObjectId(uid(12).toHexadecimal()) },
    url: {type: String, unique: true, required: true, dropDups: true},
    domain: String,
    fetch: { type: Boolean, default: false },
    fetchInterest: { type: Number, min: 0, default: 0 },

    match: { type: Boolean, default: false },
    fetchDate: { type: Date, default: Date.now },
    language: { type: String, default: null },
}, {
    autoIndex: true,
    _id: false,
    strict: true,
    minimize: false,
    versionKey: false,
    timestamps: true,
});

module.exports = mongoose.model('Page', PageSchema);
