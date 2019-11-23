const mongoose = require( 'mongoose' );

const Schema = mongoose.Schema;

const DomainSchema = new Schema( {
    _id: String,
    domain: { type: String, unique: true, required: true, dropDups: true },
    score: { type: Number, default: 0, index: true },
    nbFetch: { type: Number, default: 0, index: true },
}, {
    _id: false,
    autoIndex: false,
    strict: true,
    minimize: true,
    versionKey: false,
    timestamps: true,
} );

module.exports = DomainSchema;
