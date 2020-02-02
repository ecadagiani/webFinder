const mongoose = require( 'mongoose' );

const Schema = mongoose.Schema;

const DomainSchema = new Schema( {
    _id: String,
    domain: { type: String, required: true, index: true },
    score: { type: Number, default: 0, index: true },
    nbFetch: { type: Number, default: 0, index: true },
}, {
    autoIndex: false,
    strict: true,
    minimize: true,
    versionKey: false,
    timestamps: true,
} );

module.exports = DomainSchema;
