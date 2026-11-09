'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const noteSchema = new Schema({
    authorId: {
        type: Schema.Types.ObjectId,
        ref: 'users'
    },
    authorName: {
        type: String,
        default: 'Support Staff'
    },
    note: {
        type: String,
        required: true,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { _id: true });

const responseSchema = new Schema({
    senderType: {
        type: String,
        enum: ['user', 'admin'],
        required: true
    },
    senderId: {
        type: Schema.Types.ObjectId,
        ref: 'users'
    },
    senderName: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { _id: true });

const supportTicketSchema = new Schema({
    ticketId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'users',
        index: true,
        default: null
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },
    category: {
        type: String,
        default: 'General Support',
        index: true
    },
    priority: {
        type: String,
        enum: ['Low', 'Normal', 'High', 'Urgent'],
        default: 'Normal',
        index: true
    },
    subject: {
        type: String,
        default: 'Support Request',
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'],
        default: 'OPEN',
        index: true
    },
    assignedAdmin: {
        type: Schema.Types.ObjectId,
        ref: 'users',
        default: null,
        index: true
    },
    internalNotes: [noteSchema],
    responseHistory: [responseSchema]
}, { 
    timestamps: true 
});

// Compound indexes for performant admin queries & inbox listing
supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ userId: 1, createdAt: -1 });
supportTicketSchema.index({ assignedAdmin: 1, status: 1 });

const SupportTicket = mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema);

module.exports = SupportTicket;
