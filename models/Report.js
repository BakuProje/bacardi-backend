const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    growId: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['Curse Wand', 'BedRock', 'Staff Jail', 'Banned Sembarangan', 'Banned', 'Scam', 'Player Bermasalah', 'Other']
    },
    complaint: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'resolved'],
        default: 'pending'
    },
    responses: [{
        message: String,
        isAdmin: Boolean,
        image: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Report', reportSchema); 